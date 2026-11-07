

import os
import sqlite3
import uuid
from datetime import datetime

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types


# --------------------------------
# 1. BASIC SETUP
# --------------------------------

load_dotenv()

app = Flask(__name__)

api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key) if api_key else None

DATABASE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "chats.db"
)


# --------------------------------
# 2. DATABASE CONNECTION
# --------------------------------

def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


# --------------------------------
# 3. CREATE DATABASE TABLES
# --------------------------------

def init_db():

    connection = get_db_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES chats(id)
        )
    """)

    connection.commit()
    connection.close()


init_db()


# --------------------------------
# 4. HOME PAGE
# --------------------------------

@app.route("/")
def home():
    return render_template("index.html")


# --------------------------------
# 5. CREATE A NEW CHAT
# --------------------------------

@app.route("/chats", methods=["POST"])
def create_chat():

    chat_id = str(uuid.uuid4())

    created_at = datetime.now().isoformat(
        timespec="seconds"
    )

    connection = get_db_connection()

    connection.execute(
        """
        INSERT INTO chats (id, title, created_at)
        VALUES (?, ?, ?)
        """,
        (chat_id, "New Chat", created_at)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "chat_id": chat_id,
        "title": "New Chat"
    })


# --------------------------------
# 6. GET ALL SAVED CHATS
# --------------------------------

@app.route("/chats", methods=["GET"])
def get_chats():

    connection = get_db_connection()

    chats = connection.execute(
        """
        SELECT * FROM chats
        ORDER BY created_at DESC
        """
    ).fetchall()

    connection.close()

    return jsonify([
        dict(chat) for chat in chats
    ])


# --------------------------------
# 7. GET MESSAGES FROM A CHAT
# --------------------------------

@app.route("/chats/<chat_id>/messages", methods=["GET"])
def get_chat_messages(chat_id):

    connection = get_db_connection()

    messages = connection.execute(
        """
        SELECT role, content, created_at
        FROM messages
        WHERE chat_id = ?
        ORDER BY id
        """,
        (chat_id,)
    ).fetchall()

    connection.close()

    return jsonify([
        dict(message) for message in messages
    ])


# --------------------------------
# 8. DELETE A CHAT
# --------------------------------

@app.route("/chats/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):

    connection = get_db_connection()

    connection.execute(
        "DELETE FROM messages WHERE chat_id = ?",
        (chat_id,)
    )

    connection.execute(
        "DELETE FROM chats WHERE id = ?",
        (chat_id,)
    )

    connection.commit()
    connection.close()

    return jsonify({
        "message": "Chat deleted successfully"
    })


# --------------------------------
# 9. MAIN CHAT FUNCTION
# --------------------------------

@app.route("/chat", methods=["POST"])
def chat():

    data = request.get_json(silent=True) or {}

    user_message = data.get("message", "").strip()

    history = data.get("history", [])

    chat_id = data.get("chat_id")

    if not user_message:
        return jsonify({
            "error": "Please enter a message"
        }), 400

    if client is None:
        return jsonify({
            "error": "Gemini API key is missing"
        }), 500

    if not isinstance(history, list):
        history = []

    try:

        response = client.models.generate_content(
    model="gemini-3.5-flash-lite",

    contents=history if history else user_message,

    config=types.GenerateContentConfig(
        system_instruction="""
        You are a friendly, intelligent and professional AI assistant.

        Your personality:
        - Be friendly, polite and approachable.
        - Explain difficult topics in simple language.
        - Give accurate and useful answers.
        - Be patient with beginners.
        - Use examples whenever helpful.
        - Format answers using headings and bullet points.
        - For programming questions, explain code step by step.
        - For academic questions, teach concepts clearly.
        - Keep simple answers short and detailed answers structured.
        - Ask clarifying questions when necessary.
        - Never pretend to know something you don't know.

        Your goal is to make every conversation helpful,
        engaging and easy to understand.
        """
    )
)

        bot_response = (
            response.text or "I couldn't generate a response."
        )

        # Save messages in SQLite

        if chat_id:

            connection = get_db_connection()

            chat_exists = connection.execute(
                "SELECT id FROM chats WHERE id = ?",
                (chat_id,)
            ).fetchone()

            if chat_exists:

                now = datetime.now().isoformat(
                    timespec="seconds"
                )

                connection.executemany(
                    """
                    INSERT INTO messages
                    (chat_id, role, content, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    [
                        (chat_id, "user", user_message, now),
                        (chat_id, "model", bot_response, now)
                    ]
                )

                # Set chat title using first user message

                connection.execute(
                    """
                    UPDATE chats
                    SET title = ?
                    WHERE id = ? AND title = 'New Chat'
                    """,
                    (user_message[:40], chat_id)
                )

                connection.commit()

            connection.close()

        return jsonify({
            "response": bot_response
        })

    except Exception:

        app.logger.exception("Gemini API error")

        return jsonify({
            "error": "Gemini is temporarily unavailable. Please try again."
        }), 503


# --------------------------------
# 10. RUN FLASK APPLICATION
# --------------------------------

if __name__ == "__main__":
    app.run(debug=True)


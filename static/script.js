

const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chatBox = document.getElementById("chat-box");
const clearBtn = document.getElementById("clear-btn");
const chatHistoryElement = document.getElementById("chat-history");

let conversationHistory = [];
let currentChatId = null;


// --------------------------------
// 1. SEND MESSAGE
// --------------------------------

async function sendMessage() {

    const message = input.value.trim();

    if (message === "") {
        return;
    }

    // Display user message
    const userMessageDiv = document.createElement("div");
    userMessageDiv.classList.add("message", "user-message");
    userMessageDiv.textContent = message;

    chatBox.appendChild(userMessageDiv);

    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Create a new chat if no chat is currently open
    try {

        if (!currentChatId) {

            const chatResponse = await fetch("/chats", {
                method: "POST"
            });

            if (!chatResponse.ok) {
                throw new Error("Could not create chat");
            }

            const chatData = await chatResponse.json();
            currentChatId = chatData.chat_id;
        }

        // Add user message to conversation history
        conversationHistory.push({
            role: "user",
            parts: [{ text: message }]
        });

        // Show typing animation
        const typingDiv = document.createElement("div");
        typingDiv.classList.add(
            "message",
            "bot-message",
            "typing-message"
        );

        typingDiv.textContent = "AI is thinking";
        chatBox.appendChild(typingDiv);

        chatBox.scrollTop = chatBox.scrollHeight;
        await loadChatHistory();

        sendBtn.disabled = true;

        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                history: conversationHistory,
                chat_id: currentChatId
            })
        });

        const data = await response.json();

        typingDiv.remove();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }

        // Display AI response
        // Display formatted AI response
const botMessageDiv = document.createElement("div");

botMessageDiv.classList.add("message", "bot-message");

const formattedResponse = marked.parse(data.response);

botMessageDiv.innerHTML = DOMPurify.sanitize(formattedResponse);

chatBox.appendChild(botMessageDiv);

        // Add AI response to conversation history
        conversationHistory.push({
            role: "model",
            parts: [{ text: data.response }]
        });

        chatBox.scrollTop = chatBox.scrollHeight;

        // Refresh sidebar with updated chat title
        await loadChatHistory();

    } catch (error) {

        console.error("Chat error:", error);

        const errorDiv = document.createElement("div");
        errorDiv.classList.add("message", "bot-message");
        errorDiv.textContent = "Sorry! Something went wrong. Please try again.";

        chatBox.appendChild(errorDiv);

    } finally {

        sendBtn.disabled = false;
        input.focus();
    }
}


// --------------------------------
// 2. LOAD SAVED CHAT HISTORY
// --------------------------------

async function loadChatHistory() {

    try {

        const response = await fetch("/chats");

        if (!response.ok) {
            throw new Error("Could not load chat history");
        }

        const chats = await response.json();

        chatHistoryElement.innerHTML = "";

        chats.forEach(chat => {

            // Chat container
            const chatItem = document.createElement("div");
            chatItem.classList.add("history-item-container");

            // Chat title button
            const chatButton = document.createElement("button");

            chatButton.classList.add("history-item");
            chatButton.textContent = chat.title;
            if (chat.id === currentChatId) {
    chatButton.classList.add("active-chat");
}

            chatButton.addEventListener("click", function() {
                openChat(chat.id);
            });

            // Delete button
            const deleteButton = document.createElement("button");

            deleteButton.classList.add("delete-chat-btn");
            deleteButton.textContent = "🗑";
            deleteButton.title = "Delete this chat";

            deleteButton.addEventListener("click", function() {
                deleteChat(chat.id);
            });

            chatItem.appendChild(chatButton);
            chatItem.appendChild(deleteButton);

            chatHistoryElement.appendChild(chatItem);
        });

    } catch (error) {

        console.error("History error:", error);
    }
}


// --------------------------------
// 3. OPEN AN EXISTING CHAT
// --------------------------------

async function openChat(chatId) {

    try {

        const response = await fetch(
            `/chats/${chatId}/messages`
        );

        if (!response.ok) {
            throw new Error("Could not open conversation");
        }

        const messages = await response.json();

        currentChatId = chatId;
        conversationHistory = [];

        chatBox.innerHTML = "";

        messages.forEach(message => {

            const messageDiv = document.createElement("div");

            messageDiv.classList.add("message");

            if (message.role === "user") {
                messageDiv.classList.add("user-message");
            } else {
                messageDiv.classList.add("bot-message");
            }

            if (message.role === "user") {
    messageDiv.textContent = message.content;
} else {
    const formattedResponse = marked.parse(message.content);

    messageDiv.innerHTML = DOMPurify.sanitize(formattedResponse);
}

            chatBox.appendChild(messageDiv);

            conversationHistory.push({
                role: message.role,
                parts: [{ text: message.content }]
            });

        });

        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {

        console.error("Open chat error:", error);
        alert("Could not open this conversation.");
    }
}


// --------------------------------
// 4. DELETE A CONVERSATION
// --------------------------------

async function deleteChat(chatId) {

    const confirmDelete = confirm(
        "Are you sure you want to delete this conversation?"
    );

    if (!confirmDelete) {
        return;
    }

    try {

        const response = await fetch(`/chats/${chatId}`, {
            method: "DELETE"
        });

        if (!response.ok) {
            throw new Error("Could not delete chat");
        }

        // Reset chat window if deleted chat is currently open
        if (currentChatId === chatId) {

            currentChatId = null;
            conversationHistory = [];

            chatBox.innerHTML = `
                <div class="message bot-message">
                    Hello! 👋 How can I help you today?
                </div>
            `;
        }

        // Refresh sidebar
        await loadChatHistory();

    } catch (error) {

        console.error("Delete error:", error);

        alert("Something went wrong while deleting the chat.");
    }
}


// --------------------------------
// 5. NEW CHAT BUTTON
// --------------------------------

clearBtn.addEventListener("click", function() {

    chatBox.innerHTML = `
        <div class="message bot-message">
            Hello! 👋 How can I help you today?
        </div>
    `;

    conversationHistory = [];
    currentChatId = null;

    input.focus();
});


// --------------------------------
// 6. SEND BUTTON
// --------------------------------

sendBtn.addEventListener("click", sendMessage);


// --------------------------------
// 7. ENTER KEY
// --------------------------------

input.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        sendMessage();
    }
});


// --------------------------------
// 8. LOAD HISTORY WHEN WEBSITE OPENS
// --------------------------------

loadChatHistory();

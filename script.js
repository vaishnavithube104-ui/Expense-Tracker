let transactions = [];

const SUPABASE_URL = "https://bcjigrkmthocpecvieis.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Bliv1oKSQShzZYCoEQOIKQ_M8gTsWxz";

let supabaseClient = null;
let currentUser = null;
let authMode = "signin";
let transactionsStorageKey = null;

let expenseChart = null;
let editingId = null;

const form = document.getElementById("expenseForm");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("transactionDate");

const balanceElement = document.getElementById("balance");
const incomeElement = document.getElementById("income");
const expenseElement = document.getElementById("expense");
const transactionList = document.getElementById("transactionList");
const categorySummary = document.getElementById("categorySummary");
const searchInput = document.getElementById("searchInput");
const filterType = document.getElementById("filterType");
const filterCategory = document.getElementById("filterCategory");
const submitButton = document.getElementById("submitButton");
const cancelEdit = document.getElementById("cancelEdit");
const formTitle = document.getElementById("formTitle");
const clearAll = document.getElementById("clearAll");

dateInput.value = new Date().toISOString().split("T")[0];

form.addEventListener("submit", function (e) {
    e.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const type = typeInput.value;
    const category = categoryInput.value;
    const date = dateInput.value;

    if (description === "" || amount <= 0 || date === "") {
        alert("Please enter valid details.");
        return;
    }

    if (editingId !== null) {
        transactions = transactions.map(function (transaction) {
            if (transaction.id === editingId) {
                return {
                    ...transaction,
                    description: description,
                    amount: amount,
                    type: type,
                    category: category,
                    date: formatDate(date)
                };
            }

            return transaction;
        });

        editingId = null;
        submitButton.textContent = "Add Transaction";
        formTitle.textContent = "➕ Add Transaction";
        cancelEdit.style.display = "none";
    } else {
        transactions.push({
            id: Date.now(),
            description: description,
            amount: amount,
            type: type,
            category: category,
            date: formatDate(date)
        });
    }

    saveTransactions();
    form.reset();
    dateInput.value = new Date().toISOString().split("T")[0];

    displayTransactions();
    updateSummary();
    updateChart();
    updateCategorySummary();
});

function displayTransactions() {
    transactionList.innerHTML = "";

    const searchText = searchInput.value.toLowerCase().trim();
    const selectedType = filterType.value;
    const selectedCategory = filterCategory.value;

    const filteredTransactions = transactions.filter(function (transaction) {
        const matchesSearch = transaction.description
            .toLowerCase()
            .includes(searchText);

        const matchesType =
            selectedType === "all" || transaction.type === selectedType;

        const matchesCategory =
            selectedCategory === "all" ||
            transaction.category === selectedCategory;

        return matchesSearch && matchesType && matchesCategory;
    });

    if (filteredTransactions.length === 0) {
        transactionList.innerHTML =
            '<p class="empty">No matching transactions found.</p>';
        return;
    }

    filteredTransactions
        .slice()
        .reverse()
        .forEach(function (transaction) {
            const div = document.createElement("div");
            div.className = "transaction " + transaction.type;

            const sign = transaction.type === "income" ? "+" : "-";

            div.innerHTML = `
                <div class="transaction-info">
                    <h3>${escapeHTML(transaction.description)}</h3>
                    <p>
                        ${escapeHTML(transaction.category)}
                        •
                        ${transaction.date}
                    </p>
                </div>

                <div class="transaction-right">
                    <span class="transaction-amount">
                        ${sign} ₹${transaction.amount.toFixed(2)}
                    </span>

                    <button
                        class="edit-btn"
                        onclick="editTransaction(${transaction.id})">
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteTransaction(${transaction.id})">
                        Delete
                    </button>
                </div>
            `;

            transactionList.appendChild(div);
        });
}

function editTransaction(id) {
    const transaction = transactions.find(function (item) {
        return item.id === id;
    });

    if (!transaction) return;

    editingId = id;
    descriptionInput.value = transaction.description;
    amountInput.value = transaction.amount;
    typeInput.value = transaction.type;
    categoryInput.value = transaction.category;

    const parts = transaction.date.split("/");

    if (parts.length === 3) {
        dateInput.value =
            `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    submitButton.textContent = "Update Transaction";
    formTitle.textContent = "✏️ Edit Transaction";
    cancelEdit.style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

cancelEdit.addEventListener("click", function () {
    editingId = null;
    form.reset();

    dateInput.value = new Date().toISOString().split("T")[0];
    submitButton.textContent = "Add Transaction";
    formTitle.textContent = "➕ Add Transaction";
    cancelEdit.style.display = "none";
});

function deleteTransaction(id) {
    const confirmDelete = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmDelete) return;

    transactions = transactions.filter(function (transaction) {
        return transaction.id !== id;
    });

    saveTransactions();
    displayTransactions();
    updateSummary();
    updateChart();
    updateCategorySummary();
}

clearAll.addEventListener("click", function () {
    if (transactions.length === 0) return;

    const confirmClear = confirm("Delete all transactions?");
    if (!confirmClear) return;

    transactions = [];
    saveTransactions();
    displayTransactions();
    updateSummary();
    updateChart();
    updateCategorySummary();
});

function updateSummary() {
    let income = 0;
    let expense = 0;

    transactions.forEach(function (transaction) {
        if (transaction.type === "income") {
            income += transaction.amount;
        } else {
            expense += transaction.amount;
        }
    });

    const balance = income - expense;

    incomeElement.textContent = "₹" + income.toFixed(2);
    expenseElement.textContent = "₹" + expense.toFixed(2);
    balanceElement.textContent = "₹" + balance.toFixed(2);
}

function updateChart() {
    const categories = {};

    transactions.forEach(function (transaction) {
        if (transaction.type === "expense") {
            if (!categories[transaction.category]) {
                categories[transaction.category] = 0;
            }

            categories[transaction.category] += transaction.amount;
        }
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);
    const canvas = document.getElementById("expenseChart");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }

    if (data.length === 0) return;

    expenseChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    "#4f46e5",
                    "#16a34a",
                    "#f59e0b",
                    "#ef4444",
                    "#06b6d4",
                    "#8b5cf6",
                    "#ec4899",
                    "#14b8a6",
                    "#64748b"
                ],
                borderColor: "#ffffff",
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "60%",
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function updateCategorySummary() {
    const categories = {};

    transactions.forEach(function (transaction) {
        if (transaction.type === "expense") {
            if (!categories[transaction.category]) {
                categories[transaction.category] = 0;
            }

            categories[transaction.category] += transaction.amount;
        }
    });

    categorySummary.innerHTML = "";

    const categoryNames = Object.keys(categories);

    if (categoryNames.length === 0) {
        categorySummary.innerHTML =
            '<p class="empty">No expenses yet.</p>';
        return;
    }

    categoryNames.forEach(function (category) {
        const div = document.createElement("div");
        div.className = "category-item";

        div.innerHTML = `
            <span class="category-name">
                ${escapeHTML(category)}
            </span>

            <span class="category-amount">
                ₹${categories[category].toFixed(2)}
            </span>
        `;

        categorySummary.appendChild(div);
    });
}

searchInput.addEventListener("input", displayTransactions);
filterType.addEventListener("change", displayTransactions);
filterCategory.addEventListener("change", displayTransactions);

function formatDate(date) {
    const parts = date.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function saveTransactions() {
    if (!transactionsStorageKey) return;

    localStorage.setItem(
        transactionsStorageKey,
        JSON.stringify(transactions)
    );
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/* Sign-in and account setup */

const authScreen = document.getElementById("authScreen");
const trackerApp = document.getElementById("trackerApp");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authPasswordGroup = document.getElementById("authPasswordGroup");
const newPasswordGroup = document.getElementById("newPasswordGroup");
const newPassword = document.getElementById("newPassword");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const authTabs = document.getElementById("authTabs");
const forgotPassword = document.getElementById("forgotPassword");
const backToSignIn = document.getElementById("backToSignIn");

function setAuthMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.classList.toggle("error", isError);
}

function setAuthMode(mode) {
    authMode = mode;
    authForm.reset();
    setAuthMessage("");

    authTabs.classList.toggle("hidden", mode === "reset");
    authPasswordGroup.classList.toggle("hidden", mode === "reset");
    authPassword.required = mode !== "reset";
    newPasswordGroup.classList.toggle("hidden", mode !== "reset");
    newPassword.required = mode === "reset";
    forgotPassword.classList.toggle("hidden", mode !== "signin");
    backToSignIn.classList.toggle("hidden", mode !== "reset");

    if (mode === "signup") {
        authTitle.textContent = "Create your account";
        authSubtitle.textContent =
            "Sign up to keep your finances organized.";
        authSubmit.innerHTML =
            'Create account <span aria-hidden="true">→</span>';
    } else if (mode === "reset") {
        authTitle.textContent = "Choose a new password";
        authSubtitle.textContent =
            "Set a new password for your account.";
        authSubmit.innerHTML =
            'Update password <span aria-hidden="true">→</span>';
    } else {
        authTitle.textContent = "Welcome back";
        authSubtitle.textContent =
            "Sign in to open your Expense Tracker.";
        authSubmit.innerHTML =
            'Sign in <span aria-hidden="true">→</span>';
    }

    authTabs.querySelectorAll(".auth-tab").forEach((button) => {
        const selected = button.dataset.mode === mode;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-selected", String(selected));
    });
}

function showSignedInApp(session) {
    currentUser = session?.user || null;

    if (!currentUser) {
        transactionsStorageKey = null;
        transactions = [];
        trackerApp.classList.add("hidden");
        authScreen.classList.remove("hidden");
        return;
    }

    transactionsStorageKey = `transactions:${currentUser.id}`;

    try {
        transactions =
            JSON.parse(localStorage.getItem(transactionsStorageKey)) || [];
    } catch {
        transactions = [];
    }

    document.getElementById("signedInEmail").textContent =
        currentUser.email || "your account";

    authScreen.classList.add("hidden");
    trackerApp.classList.remove("hidden");

    displayTransactions();
    updateSummary();
    updateChart();
    updateCategorySummary();
}

function initializeAuth() {
    const configured =
        SUPABASE_URL.startsWith("https://") &&
        SUPABASE_PUBLISHABLE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY" &&
        SUPABASE_PUBLISHABLE_KEY.trim() !== "";

    if (!window.supabase || !configured) {
        setAuthMessage(
            "Add your Supabase project URL and publishable key in script.js to enable sign-in.",
            true
        );

        authForm.addEventListener("submit", (event) => {
            event.preventDefault();
        });

        return;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
            currentUser = session?.user || null;
            trackerApp.classList.add("hidden");
            authScreen.classList.remove("hidden");
            setAuthMode("reset");
            return;
        }

        showSignedInApp(session);
    });

    supabaseClient.auth.getSession().then(({ data, error }) => {
        if (error) setAuthMessage(error.message, true);
        showSignedInApp(data?.session || null);
    });
}

authTabs.querySelectorAll(".auth-tab").forEach((button) => {
    button.addEventListener("click", () => {
        setAuthMode(button.dataset.mode);
    });
});

forgotPassword.addEventListener("click", async () => {
    if (!supabaseClient) return;

    const email = authEmail.value.trim();

    if (!email) {
        setAuthMessage("Enter your email address first.", true);
        authEmail.focus();
        return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href.split("#")[0].split("?")[0]
    });

    setAuthMessage(
        error
            ? error.message
            : "If an account uses that email, a password reset link will be sent.",
        Boolean(error)
    );
});

backToSignIn.addEventListener("click", () => {
    setAuthMode("signin");
});

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
        setAuthMessage(
            "Add your Supabase project URL and publishable key in script.js to enable sign-in.",
            true
        );
        return;
    }

    const email = authEmail.value.trim();
    authSubmit.disabled = true;
    setAuthMessage("");

    try {
        if (authMode === "reset") {
            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword.value
            });

            if (error) throw error;

            setAuthMode("signin");
            setAuthMessage(
                "Your password has been updated. Sign in with your new password."
            );
            return;
        }

        if (authMode === "signup") {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: authPassword.value,
                options: {
                    emailRedirectTo:
                        window.location.href.split("#")[0].split("?")[0]
                }
            });

            if (error) throw error;

            if (data.session) {
                showSignedInApp(data.session);
            } else {
                setAuthMessage(
                    "Account created. Check your email to confirm your account, then sign in."
                );
            }
        } else {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: authPassword.value
                });

            if (error) throw error;
            showSignedInApp(data.session);
        }
    } catch (error) {
        setAuthMessage(
            error.message || "Authentication failed. Please try again.",
            true
        );
    } finally {
        authSubmit.disabled = false;
    }
});

document
    .getElementById("signOutButton")
    .addEventListener("click", async () => {
        if (!supabaseClient) return;

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            setAuthMessage(error.message, true);
        } else {
            setAuthMode("signin");
        }
    });

initializeAuth();
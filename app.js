// Constants
const MODULE_ADDRESS = "0xfcf65ce1a09f19218795e82a140d48141f7999189c70365120c94a5b0439d8b0";
const MODULE_NAME = "LendingPlatform";
const NETWORK = "mainnet"; // or "testnet" or "devnet"
const APTOS_NODE_URL = "https://fullnode.mainnet.aptoslabs.com"; // Update for testnet/devnet as needed

// Global variables
let wallet;
let client;
let account;
let accountAddress;
let userBalance = 0;
let userLent = 0;
let userDebt = 0;
let poolAvailable = 0;

// DOM Elements
const connectWalletBtn = document.getElementById("connect-wallet");
const walletAddressDisplay = document.getElementById("wallet-address");
const walletBalanceDisplay = document.getElementById("wallet-balance");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Function to initialize the Aptos client
async function initializeAptosClient() {
    client = new aptos.AptosClient(APTOS_NODE_URL);
}

// Function to connect WellDone wallet
async function connectWallet() {
    try {
        // Check if WellDone wallet is installed
        if (!window.welldone) {
            showTransactionStatus("WellDone wallet not installed. Please install it first.", "error");
            return;
        }

        // Connect to WellDone wallet
        wallet = window.welldone;
        const response = await wallet.connect();
        
        if (response.status === "success") {
            // Get account info
            account = response.data.account;
            accountAddress = account.address;

            // Update UI
            walletAddressDisplay.textContent = `Wallet: ${shortenAddress(accountAddress)}`;
            connectWalletBtn.textContent = "Connected";
            connectWalletBtn.disabled = true;

            // Get user balance and other data
            await updateUserData();
            await updatePoolData();
        } else {
            showTransactionStatus("Failed to connect: " + response.message, "error");
        }
    } catch (error) {
        console.error("Error connecting wallet:", error);
        showTransactionStatus(`Failed to connect wallet: ${error.message}`, "error");
    }
}

// Function to update user data
async function updateUserData() {
    try {
        if (!account) return;

        // Get APT balance
        const accountResource = await client.getAccountResources(accountAddress);
        const aptCoinStore = accountResource.find(
            (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
        );
        
        if (aptCoinStore) {
            userBalance = Number(aptCoinStore.data.coin.value) / 100000000; // Converting octas to APT
            walletBalanceDisplay.textContent = `Balance: ${userBalance.toFixed(4)} APT`;
        }

        // Get user lent amount
        try {
            const lenderResource = await client.getAccountResource(
                accountAddress,
                `${MODULE_ADDRESS}::${MODULE_NAME}::LenderPosition`
            );
            userLent = Number(lenderResource.data.amount_lent) / 100000000;
            document.getElementById("user-lent").textContent = `${userLent.toFixed(4)} APT`;
            document.getElementById("user-lent-withdraw").textContent = `${userLent.toFixed(4)} APT`;
        } catch (error) {
            // Resource might not exist yet
            userLent = 0;
            document.getElementById("user-lent").textContent = "0 APT";
            document.getElementById("user-lent-withdraw").textContent = "0 APT";
        }

        // Get user debt amount
        try {
            const borrowerResource = await client.getAccountResource(
                accountAddress,
                `${MODULE_ADDRESS}::${MODULE_NAME}::BorrowerPosition`
            );
            userDebt = Number(borrowerResource.data.debt_amount) / 100000000;
            document.getElementById("user-debt").textContent = `${userDebt.toFixed(4)} APT`;
            document.getElementById("user-debt-repay").textContent = `${userDebt.toFixed(4)} APT`;
        } catch (error) {
            // Resource might not exist yet
            userDebt = 0;
            document.getElementById("user-debt").textContent = "0 APT";
            document.getElementById("user-debt-repay").textContent = "0 APT";
        }
    } catch (error) {
        console.error("Error updating user data:", error);
    }
}

// Function to update platform data
async function updatePoolData() {
    try {
        // Get pool data
        try {
            const poolResource = await client.getAccountResource(
                MODULE_ADDRESS,
                `${MODULE_ADDRESS}::${MODULE_NAME}::LendingPool`
            );
            poolAvailable = Number(poolResource.data.funds.value) / 100000000;
            document.getElementById("pool-available").textContent = `${poolAvailable.toFixed(4)} APT`;
            document.getElementById("available-liquidity").textContent = `${poolAvailable.toFixed(4)} APT`;
        } catch (error) {
            // Resource might not exist yet
            poolAvailable = 0;
            document.getElementById("pool-available").textContent = "0 APT";
            document.getElementById("available-liquidity").textContent = "0 APT";
        }

        // For demonstration, we'll set some placeholder values
        // In a real app, you'd calculate these from blockchain data
        document.getElementById("total-deposits").textContent = `${(poolAvailable + userDebt).toFixed(4)} APT`;
        document.getElementById("total-borrowed").textContent = `${userDebt.toFixed(4)} APT`;
        document.getElementById("active-lenders").textContent = userLent > 0 ? "1" : "0";
        document.getElementById("active-borrowers").textContent = userDebt > 0 ? "1" : "0";
    } catch (error) {
        console.error("Error updating pool data:", error);
    }
}

// Function to lend funds
async function lendFunds() {
    try {
        if (!account) {
            showTransactionStatus("Please connect your wallet first", "error");
            return;
        }

        const amountInput = document.getElementById("lend-amount");
        const amount = parseFloat(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            showTransactionStatus("Please enter a valid amount", "error");
            return;
        }

        if (amount > userBalance) {
            showTransactionStatus("Insufficient balance", "error");
            return;
        }

        const amountInOctas = Math.floor(amount * 100000000);
        showTransactionStatus("Transaction pending...", "pending");

        const payload = {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::lend_funds`,
            type_arguments: [],
            arguments: [amountInOctas.toString()]
        };

        const response = await wallet.signAndSubmitTransaction(payload);
        
        if (response.status === "success") {
            await client.waitForTransaction(response.data.hash);
            showTransactionStatus("Successfully lent funds!", "success");
            amountInput.value = "";
            
            // Update user and pool data
            await updateUserData();
            await updatePoolData();
        } else {
            showTransactionStatus(`Failed to lend funds: ${response.message}`, "error");
        }
    } catch (error) {
        console.error("Error lending funds:", error);
        showTransactionStatus(`Failed to lend funds: ${error.message}`, "error");
    }
}

// Function to borrow funds
async function borrowFunds() {
    try {
        if (!account) {
            showTransactionStatus("Please connect your wallet first", "error");
            return;
        }

        const amountInput = document.getElementById("borrow-amount");
        const amount = parseFloat(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            showTransactionStatus("Please enter a valid amount", "error");
            return;
        }

        if (amount > poolAvailable) {
            showTransactionStatus("Insufficient funds in the pool", "error");
            return;
        }

        const amountInOctas = Math.floor(amount * 100000000);
        showTransactionStatus("Transaction pending...", "pending");

        const payload = {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::borrow_funds`,
            type_arguments: [],
            arguments: [amountInOctas.toString()]
        };

        const response = await wallet.signAndSubmitTransaction(payload);
        
        if (response.status === "success") {
            await client.waitForTransaction(response.data.hash);
            showTransactionStatus("Successfully borrowed funds!", "success");
            amountInput.value = "";
            
            // Update user and pool data
            await updateUserData();
            await updatePoolData();
        } else {
            showTransactionStatus(`Failed to borrow funds: ${response.message}`, "error");
        }
    } catch (error) {
        console.error("Error borrowing funds:", error);
        showTransactionStatus(`Failed to borrow funds: ${error.message}`, "error");
    }
}

// Function to repay loan
async function repayLoan() {
    try {
        if (!account) {
            showTransactionStatus("Please connect your wallet first", "error");
            return;
        }

        const amountInput = document.getElementById("repay-amount");
        const amount = parseFloat(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            showTransactionStatus("Please enter a valid amount", "error");
            return;
        }

        if (amount > userDebt) {
            showTransactionStatus("Amount exceeds your debt", "error");
            return;
        }

        if (amount > userBalance) {
            showTransactionStatus("Insufficient balance", "error");
            return;
        }

        const amountInOctas = Math.floor(amount * 100000000);
        showTransactionStatus("Transaction pending...", "pending");

        const payload = {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::repay_loan`,
            type_arguments: [],
            arguments: [amountInOctas.toString()]
        };

        const response = await wallet.signAndSubmitTransaction(payload);
        
        if (response.status === "success") {
            await client.waitForTransaction(response.data.hash);
            showTransactionStatus("Successfully repaid loan!", "success");
            amountInput.value = "";
            
            // Update user and pool data
            await updateUserData();
            await updatePoolData();
        } else {
            showTransactionStatus(`Failed to repay loan: ${response.message}`, "error");
        }
    } catch (error) {
        console.error("Error repaying loan:", error);
        showTransactionStatus(`Failed to repay loan: ${error.message}`, "error");
    }
}

// Function to withdraw funds
async function withdrawFunds() {
    try {
        if (!account) {
            showTransactionStatus("Please connect your wallet first", "error");
            return;
        }

        const amountInput = document.getElementById("withdraw-amount");
        const amount = parseFloat(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            showTransactionStatus("Please enter a valid amount", "error");
            return;
        }

        if (amount > userLent) {
            showTransactionStatus("Amount exceeds your deposited funds", "error");
            return;
        }

        if (amount > poolAvailable) {
            showTransactionStatus("Insufficient liquidity in the pool", "error");
            return;
        }

        const amountInOctas = Math.floor(amount * 100000000);
        showTransactionStatus("Transaction pending...", "pending");

        const payload = {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::withdraw_funds`,
            type_arguments: [],
            arguments: [amountInOctas.toString()]
        };

        const response = await wallet.signAndSubmitTransaction(payload);
        
        if (response.status === "success") {
            await client.waitForTransaction(response.data.hash);
            showTransactionStatus("Successfully withdrawn funds!", "success");
            amountInput.value = "";
            
            // Update user and pool data
            await updateUserData();
            await updatePoolData();
        } else {
            showTransactionStatus(`Failed to withdraw funds: ${response.message}`, "error");
        }
    } catch (error) {
        console.error("Error withdrawing funds:", error);
        showTransactionStatus(`Failed to withdraw funds: ${error.message}`, "error");
    }
}

// Function to show transaction status
function showTransactionStatus(message, type) {
    const statusElement = document.getElementById("transaction-status");
    statusElement.textContent = message;
    statusElement.className = "transaction-status";
    statusElement.classList.add(type);
    
    if (type !== "pending") {
        setTimeout(() => {
            statusElement.style.display = "none";
        }, 5000);
    }
}

// Function to shorten address for display
function shortenAddress(address) {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Tab switching functionality
function switchTab(target) {
    // Remove active class from all tabs
    tabButtons.forEach(button => button.classList.remove("active"));
    tabContents.forEach(content => content.classList.remove("active"));
    
    // Add active class to selected tab
    const selectedTab = document.querySelector(`[data-tab="${target}"]`);
    selectedTab.classList.add("active");
    
    const selectedContent = document.getElementById(`${target}-tab`);
    selectedContent.classList.add("active");
}

// Event listeners
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Aptos client
    await initializeAptosClient();
    
    // Connect wallet button
    connectWalletBtn.addEventListener("click", connectWallet);
    
    // Tab buttons
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            switchTab(button.dataset.tab);
        });
    });
    
    // Action buttons
    document.getElementById("lend-submit").addEventListener("click", lendFunds);
    document.getElementById("borrow-submit").addEventListener("click", borrowFunds);
    document.getElementById("repay-submit").addEventListener("click", repayLoan);
    document.getElementById("withdraw-submit").addEventListener("click", withdrawFunds);
    
    // Check if wallet is already connected
    try {
        if (window.welldone) {
            wallet = window.welldone;
            const isConnected = await wallet.isConnected();
            if (isConnected) {
                const response = await wallet.account();
                if (response.status === "success") {
                    account = response.data;
                    accountAddress = account.address;
                    walletAddressDisplay.textContent = `Wallet: ${shortenAddress(accountAddress)}`;
                    connectWalletBtn.textContent = "Connected";
                    connectWalletBtn.disabled = true;
                    await updateUserData();
                    await updatePoolData();
                }
            }
        }
    } catch (error) {
        console.error("Error checking wallet connection:", error);
    }
});

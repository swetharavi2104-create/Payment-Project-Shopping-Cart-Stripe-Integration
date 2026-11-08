require("dotenv").config();

const express = require("express");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Products
const products = [
    { id: 1, name: "JavaScript Book", price: 500 },
    { id: 2, name: "Node.js Course", price: 1500 },
    { id: 3, name: "Web Development Bundle", price: 3000 },
    { id: 4, name: "React Tutorial", price: 1200 },
    { id: 5, name: "Database Design", price: 2000 }
];

// Home Page
app.get("/", (req, res) => {
    res.render("home", {
        key: process.env.STRIPE_PUBLISHABLE_KEY
    });
});

// Create Payment
app.post("/payment", async (req, res) => {
    try {
        const amount = Number(req.body.amount);

        // Validate amount using available products
        const validAmounts = new Set();

        function calculateTotals(index, total) {
            if (index === products.length) {
                validAmounts.add(total);
                return;
            }

            calculateTotals(index + 1, total);

            calculateTotals(
                index + 1,
                total + products[index].price
            );
        }

        calculateTotals(0, 0);

        if (
            !Number.isInteger(amount) ||
            amount <= 0 ||
            !validAmounts.has(amount)
        ) {
            return res.status(400).send("Invalid payment amount");
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],

            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: "Shopping Cart Purchase"
                        },
                        unit_amount: amount * 100
                    },
                    quantity: 1
                }
            ],

            mode: "payment",

            success_url:
                "http://localhost:8001/success?session_id={CHECKOUT_SESSION_ID}",

            cancel_url:
                "http://localhost:8001/cancel"
        });

        res.redirect(303, session.url);

    } catch (error) {
        console.error("Payment Error:", error.message);
        res.status(500).send("Payment failed. Please try again.");
    }
});

// Payment Success Page
app.get("/success", async (req, res) => {
    try {
        const sessionId = req.query.session_id;

        if (!sessionId) {
            return res.status(400).send("Payment session missing");
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== "paid") {
            return res.status(400).send("Payment not completed");
        }

        const amount = (session.amount_total / 100).toFixed(2);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Successful</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <style>
                    * {
                        box-sizing: border-box;
                    }

                    body {
                        font-family: Arial, sans-serif;
                        background: #f0fff4;
                        text-align: center;
                        padding: 50px 15px;
                    }

                    .box {
                        background: white;
                        padding: 40px 25px;
                        max-width: 450px;
                        margin: 50px auto;
                        border-radius: 15px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    }

                    .icon {
                        background: #28a745;
                        color: white;
                        width: 75px;
                        height: 75px;
                        line-height: 75px;
                        border-radius: 50%;
                        font-size: 40px;
                        margin: auto;
                    }

                    h1 {
                        color: #28a745;
                    }

                    .amount {
                        font-size: 25px;
                        font-weight: bold;
                        color: #252b48;
                    }

                    a {
                        display: inline-block;
                        background: #28a745;
                        color: white;
                        padding: 13px 25px;
                        text-decoration: none;
                        border-radius: 7px;
                        margin-top: 20px;
                    }

                    a:hover {
                        background: #218838;
                    }
                </style>
            </head>

            <body>
                <div class="box">
                    <div class="icon">✓</div>

                    <h1>Payment Successful!</h1>

                    <h2>Thank You!</h2>

                    <p>Your payment was completed successfully.</p>

                    <p class="amount">₹${amount}</p>

                    <p>Your order has been confirmed.</p>

                    <a href="/">Continue Shopping</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error("Verification Error:", error.message);
        res.status(500).send("Unable to verify payment");
    }
});

// Payment Cancel Page
app.get("/cancel", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Cancelled</title>

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #fff5f5;
                    text-align: center;
                    padding: 50px 15px;
                }

                .box {
                    background: white;
                    max-width: 450px;
                    margin: 50px auto;
                    padding: 40px 25px;
                    border-radius: 15px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                }

                h1 {
                    color: #dc3545;
                }

                a {
                    display: inline-block;
                    background: #007bff;
                    color: white;
                    padding: 13px 25px;
                    text-decoration: none;
                    border-radius: 7px;
                    margin-top: 20px;
                }

                a:hover {
                    background: #0056b3;
                }
            </style>
        </head>

        <body>
            <div class="box">
                <h1>✕ Payment Cancelled</h1>

                <h2>No Payment Completed</h2>

                <p>Your payment was cancelled.</p>

                <p>You can return and try again.</p>

                <a href="/">Go Back to Shopping</a>
            </div>
        </body>
        </html>
    `);
});

// Server
const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
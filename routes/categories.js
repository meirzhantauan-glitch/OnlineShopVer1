const express = require("express");
const db = require("../db");

const categoryRouter = express.Router();
const customerRouter = express.Router();

// для проверки - GET /api/categories: список категорий
categoryRouter.get("/", function (_, response) {
    response.json(db.prepare("SELECT * FROM categories ORDER BY id").all());
});

// для проверки - POST /api/categories: добавление категории, проверка названия (400) и дубля (409)
categoryRouter.post("/", function (request, response) {
    const body = request.body;
    if (!body || !body.name || String(body.name).trim() === "") {
        return response.status(400).json({ error: "Ошибка валидации", details: ["Поле name обязательно"] });
    }
    const name = String(body.name).trim();
    const exists = db.prepare("SELECT id FROM categories WHERE name = ?").get(name);
    if (exists) return response.status(409).json({ error: "Такая категория уже есть", details: [] });

    const result = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)")
        .run(name, body.description || "");
    response.status(201).json({ id: result.lastInsertRowid, name: name, description: body.description || "" });
});

// для проверки - GET /api/customers: список клиентов вместе с картой лояльности
customerRouter.get("/", function (_, response) {
    response.json(db.prepare(
        `SELECT c.*, l.card_number, l.discount_percent
         FROM customers c LEFT JOIN loyalty_cards l ON l.customer_id = c.id
         ORDER BY c.id`
    ).all());
});

// для проверки - POST /api/customers: добавление клиента, проверка полей и формата email (400), дубль email (409)
customerRouter.post("/", function (request, response) {
    const body = request.body;
    const errors = [];
    if (!body || !body.full_name) errors.push("Поле full_name обязательно");
    if (!body || !body.email) errors.push("Поле email обязательно");
    else if (!/^\S+@\S+\.\S+$/.test(body.email)) errors.push("email имеет неверный формат");
    if (errors.length > 0) return response.status(400).json({ error: "Ошибка валидации", details: errors });

    const exists = db.prepare("SELECT id FROM customers WHERE email = ?").get(body.email);
    if (exists) return response.status(409).json({ error: "Клиент с таким email уже есть", details: [] });

    const result = db.prepare("INSERT INTO customers (full_name, email, phone, address) VALUES (?, ?, ?, ?)")
        .run(body.full_name, body.email, body.phone || "", body.address || "");
    response.status(201).json(db.prepare("SELECT * FROM customers WHERE id = ?").get(result.lastInsertRowid));
});

module.exports = { categoryRouter, customerRouter };

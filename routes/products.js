const express = require("express");
const db = require("../db");
const models = require("../models");
const { validateProduct, skuExists } = require("../validate");
const { uploadPhoto, removePhoto } = require("../upload");

const productRouter = express.Router();

// для проверки - экранирует спецсимволы, чтобы XML не ломался
function xmlEscape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// для проверки - GET /api/products: список товаров в JSON с фильтрами из строки запроса
productRouter.get("/", function (request, response) {
    const products = models.findProducts(request.query);
    response.json(products);
});

// для проверки - GET /api/products/:id/xml: один товар в формате XML
productRouter.get("/:id/xml", function (request, response) {
    const product = models.findProduct(request.params.id);
    if (!product) return response.status(404).json({ error: "Товар не найден", details: [] });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<product id="${product.id}">
    <name>${xmlEscape(product.name)}</name>
    <description>${xmlEscape(product.description || "")}</description>
    <price>${product.price}</price>
    <stock>${product.stock}</stock>
    <sku>${xmlEscape(product.sku)}</sku>
    <category>${xmlEscape(product.category_name)}</category>
</product>`;
    response.type("application/xml").send(xml);
});

// для проверки - GET /api/products/:id: один товар в JSON, 404 если не найден
productRouter.get("/:id", function (request, response) {
    const product = models.findProduct(request.params.id);
    if (!product) return response.status(404).json({ error: "Товар не найден", details: [] });
    response.json(product);
});

// для проверки - POST /api/products: добавление товара с валидацией (400) и проверкой дубля sku (409)
productRouter.post("/", function (request, response) {
    const body = request.body;
    if (!body) return response.sendStatus(400);

    const errors = validateProduct(body);
    if (errors.length > 0) {
        return response.status(400).json({ error: "Ошибка валидации", details: errors });
    }
    if (skuExists(body.sku)) {
        return response.status(409).json({ error: "Товар с таким sku уже существует", details: [] });
    }

    const result = db.prepare(
        `INSERT INTO products (name, description, price, stock, sku, image_url, category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(String(body.name).trim(), body.description || "", Number(body.price), Number(body.stock || 0),
          String(body.sku).trim(), body.image_url || "", body.category_id);

    response.status(201).json(models.findProduct(result.lastInsertRowid));
});

// для проверки - PUT /api/products/:id: изменение товара
productRouter.put("/:id", function (request, response) {
    const id = request.params.id;
    if (!models.findProduct(id)) return response.status(404).json({ error: "Товар не найден", details: [] });

    const body = request.body;
    const errors = validateProduct(body);
    if (errors.length > 0) {
        return response.status(400).json({ error: "Ошибка валидации", details: errors });
    }
    if (skuExists(body.sku, id)) {
        return response.status(409).json({ error: "Товар с таким sku уже существует", details: [] });
    }

    db.prepare(
        `UPDATE products SET name = ?, description = ?, price = ?, stock = ?, sku = ?,
                image_url = ?, category_id = ?, is_active = ?
         WHERE id = ?`
    ).run(String(body.name).trim(), body.description || "", Number(body.price), Number(body.stock || 0),
          String(body.sku).trim(), body.image_url || "", body.category_id,
          body.is_active === false || body.is_active === 0 ? 0 : 1, id);

    response.json(models.findProduct(id));
});

// для проверки - POST /api/products/:id/photo: загрузка фото товара (form-data, поле photo)
productRouter.post("/:id/photo", uploadPhoto, function (request, response) {
    const product = models.findProduct(request.params.id);
    if (!product) {
        if (request.file) removePhoto("/uploads/" + request.file.filename);
        return response.status(404).json({ error: "Товар не найден", details: [] });
    }
    if (request.uploadError) {
        return response.status(400).json({ error: "Ошибка загрузки", details: [request.uploadError] });
    }
    if (!request.file) {
        return response.status(400).json({ error: "Ошибка валидации", details: ["Поле photo (файл) обязательно"] });
    }
    db.prepare("UPDATE products SET image_url = ? WHERE id = ?").run("/uploads/" + request.file.filename, product.id);
    removePhoto(product.image_url);
    response.json(models.findProduct(product.id));
});

// для проверки - DELETE /api/products/:id: удаление товара и его фото, 409 если товар есть в заказах
productRouter.delete("/:id", function (request, response) {
    const id = request.params.id;
    if (!models.findProduct(id)) return response.status(404).json({ error: "Товар не найден", details: [] });

    try {
        const old = models.findProduct(id);
        db.prepare("DELETE FROM products WHERE id = ?").run(id);
        removePhoto(old.image_url);
        response.sendStatus(204);
    } catch (error) {
        response.status(409).json({ error: "Нельзя удалить товар, он есть в заказах", details: [] });
    }
});

module.exports = productRouter;

const express = require("express");
const models = require("../models");

const orderRouter = express.Router();

// для проверки - GET /api/orders: список всех заказов
orderRouter.get("/", function (_, response) {
    response.json(models.getAllOrders());
});

// для проверки - GET /api/orders/:id: заказ вместе с составом, 404 если не найден
orderRouter.get("/:id", function (request, response) {
    const order = models.getOrder(request.params.id);
    if (!order) return response.status(404).json({ error: "Заказ не найден", details: [] });
    response.json(order);
});

// для проверки - POST /api/orders: создание заказа из JSON {customerId, items}, валидация (400), склад и клиент (422, 404)
orderRouter.post("/", function (request, response) {
    const body = request.body;
    if (!body) return response.sendStatus(400);

    const errors = [];
    if (!body.customerId) errors.push("Поле customerId обязательно");
    if (!Array.isArray(body.items) || body.items.length === 0) {
        errors.push("items должен быть непустым массивом");
    } else {
        body.items.forEach(function (item, index) {
            if (!Number.isInteger(item.productId)) errors.push(`items[${index}].productId должен быть целым числом`);
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                errors.push(`items[${index}].quantity должен быть целым числом > 0`);
            }
        });
    }
    if (errors.length > 0) return response.status(400).json({ error: "Ошибка валидации", details: errors });

    const orderId = models.createOrder(body.customerId, body.items);
    response.status(201).json(models.getOrder(orderId));
});

// для проверки - PUT /api/orders/:id/status: смена статуса заказа из JSON {status}
orderRouter.put("/:id/status", function (request, response) {
    const status = request.body && request.body.status;
    if (!status) {
        return response.status(400).json({ error: "Ошибка валидации", details: ["Поле status обязательно"] });
    }
    models.changeOrderStatus(request.params.id, status);
    response.json(models.getOrder(request.params.id));
});

module.exports = orderRouter;

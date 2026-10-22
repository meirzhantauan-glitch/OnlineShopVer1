const db = require("./db");

// для проверки - создаёт ошибку с кодом статуса (её ловит обработчик ошибок в app.js)
function httpError(status, message, details) {
    const error = new Error(message);
    error.status = status;
    error.details = details || [];
    return error;
}

// для проверки - список товаров с фильтрами category, search, maxPrice из строки запроса
function findProducts(query) {
    let sql = `SELECT p.*, c.name AS category_name
               FROM products p JOIN categories c ON c.id = p.category_id
               WHERE 1 = 1`;
    const params = [];

    if (query.category) {
        sql += " AND p.category_id = ?";
        params.push(query.category);
    }
    if (query.search) {
        sql += " AND p.name LIKE ?";
        params.push("%" + query.search + "%");
    }
    if (query.maxPrice) {
        sql += " AND p.price <= ?";
        params.push(Number(query.maxPrice));
    }
    sql += " ORDER BY p.id";
    return db.prepare(sql).all(...params);
}

// для проверки - один товар по id вместе с названием категории
function findProduct(id) {
    return db.prepare(
        `SELECT p.*, c.name AS category_name
         FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?`
    ).get(id);
}

// для проверки - допустимые переходы между статусами заказа
const nextStatuses = {
    new: ["paid", "cancelled"],
    paid: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: []
};

// для проверки - один заказ вместе с его составом
function getOrder(id) {
    const order = db.prepare(
        `SELECT o.*, c.full_name AS customer_name
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE o.id = ?`
    ).get(id);
    if (!order) return undefined;
    order.items = db.prepare(
        `SELECT oi.product_id, p.name, oi.quantity, oi.unit_price
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`
    ).all(id);
    return order;
}

// для проверки - список всех заказов, новые сверху
function getAllOrders() {
    return db.prepare(
        `SELECT o.*, c.full_name AS customer_name
         FROM orders o JOIN customers c ON c.id = o.customer_id
         ORDER BY o.id DESC`
    ).all();
}

// для проверки - создание заказа в транзакции: проверка склада, уменьшение остатка, расчёт суммы
function createOrder(customerId, items) {
    const transaction = db.transaction(function () {
        const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
        if (!customer) throw httpError(404, "Клиент не найден");

        const result = db.prepare(
            "INSERT INTO orders (customer_id, status, total_price) VALUES (?, 'new', 0)"
        ).run(customerId);
        const orderId = result.lastInsertRowid;

        let total = 0;
        for (const item of items) {
            const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.productId);
            if (!product) throw httpError(404, `Товар с id=${item.productId} не найден`);
            if (!product.is_active) throw httpError(422, `Товар "${product.name}" недоступен`);
            if (product.stock < item.quantity) {
                throw httpError(422, `Недостаточно товара "${product.name}" на складе (есть ${product.stock})`);
            }
            db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, product.id);
            db.prepare(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
            ).run(orderId, product.id, item.quantity, product.price);
            total += product.price * item.quantity;
        }
        db.prepare("UPDATE orders SET total_price = ? WHERE id = ?").run(total, orderId);
        return orderId;
    });
    return transaction();
}

// для проверки - смена статуса заказа с проверкой допустимого перехода, при отмене товар возвращается на склад
function changeOrderStatus(orderId, newStatus) {
    const transaction = db.transaction(function () {
        const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
        if (!order) throw httpError(404, "Заказ не найден");

        const allowed = nextStatuses[order.status];
        if (!nextStatuses[newStatus]) throw httpError(400, "Неизвестный статус: " + newStatus);
        if (!allowed.includes(newStatus)) {
            throw httpError(422, `Нельзя перевести заказ из "${order.status}" в "${newStatus}"`);
        }
        if (newStatus === "cancelled") {
            const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
            for (const item of items) {
                db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.quantity, item.product_id);
            }
        }
        db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(newStatus, orderId);
    });
    transaction();
}

module.exports = { httpError, findProducts, findProduct, getOrder, getAllOrders, createOrder, changeOrderStatus, nextStatuses };

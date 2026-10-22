const db = require("./db");

// для проверки - проверка данных товара, возвращает массив ошибок (пустой, если всё верно)
function validateProduct(body) {
    const errors = [];

    if (!body.name || String(body.name).trim() === "") errors.push("Поле name обязательно");
    if (!body.sku || String(body.sku).trim() === "") errors.push("Поле sku обязательно");
    if (body.price === undefined || body.price === "") errors.push("Поле price обязательно");
    if (!body.category_id) errors.push("Поле category_id обязательно");

    if (body.price !== undefined && body.price !== "") {
        if (isNaN(Number(body.price))) errors.push("price должен быть числом");
        else if (Number(body.price) <= 0) errors.push("price должен быть больше 0");
    }
    if (body.stock !== undefined && body.stock !== "") {
        if (!Number.isInteger(Number(body.stock)) || Number(body.stock) < 0) {
            errors.push("stock должен быть целым числом >= 0");
        }
    }
    if (body.category_id) {
        const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(body.category_id);
        if (!category) errors.push("Категория с таким category_id не найдена");
    }
    return errors;
}

// для проверки - проверка, что такой sku уже есть у другого товара (exceptId - сам редактируемый товар)
function skuExists(sku, exceptId) {
    const row = db.prepare("SELECT id FROM products WHERE sku = ? AND id != ?").get(String(sku).trim(), exceptId || 0);
    return !!row;
}

module.exports = { validateProduct, skuExists };

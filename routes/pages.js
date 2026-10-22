const express = require("express");
const db = require("../db");
const models = require("../models");
const { validateProduct, skuExists } = require("../validate");
const { uploadPhoto, removePhoto } = require("../upload");

const pagesRouter = express.Router();

// для проверки - парсер данных обычной HTML-формы
const urlencodedParser = express.urlencoded({ extended: false });

// для проверки - список категорий для выпадающих списков
function getCategories() {
    return db.prepare("SELECT * FROM categories").all();
}

// для проверки - главная страница: каталог с фильтром по категории и поиском
pagesRouter.get("/", function (request, response) {
    response.render("index", {
        active: "catalog",
        products: models.findProducts(request.query),
        categories: getCategories(),
        selectedCategory: request.query.category || "",
        search: request.query.search || ""
    });
});

// для проверки - страница с формой добавления товара
pagesRouter.get("/products/create", function (_, response) {
    response.render("product_form", {
        active: "add", heading: "Добавить товар", action: "/products/create",
        categories: getCategories(), errors: [], values: {}, currentImage: ""
    });
});

// для проверки - сохранение нового товара из формы (с фото), при ошибках форма показывается снова
pagesRouter.post("/products/create", uploadPhoto, function (request, response) {
    const body = request.body || {};

    let errors = validateProduct(body);
    if (request.uploadError) errors.unshift(request.uploadError);
    if (errors.length === 0 && skuExists(body.sku)) errors = ["Товар с таким sku уже существует"];

    if (errors.length > 0) {
        if (request.file) removePhoto("/uploads/" + request.file.filename);
        return response.status(400).render("product_form", {
            active: "add", heading: "Добавить товар", action: "/products/create",
            categories: getCategories(), errors: errors, values: body, currentImage: ""
        });
    }
    const image = request.file ? "/uploads/" + request.file.filename : "";
    const result = db.prepare(
        "INSERT INTO products (name, description, price, stock, sku, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(String(body.name).trim(), body.description || "", Number(body.price), Number(body.stock || 0),
          String(body.sku).trim(), image, body.category_id);

    response.redirect("/products/" + result.lastInsertRowid);
});

// для проверки - страница одного товара, 404 если не найден
pagesRouter.get("/products/:id", function (request, response) {
    const product = models.findProduct(request.params.id);
    if (!product) {
        return response.status(404).send("<h2>Товар не найден</h2><a href='/'>На главную</a>");
    }
    response.render("product", { active: "catalog", product: product });
});

// для проверки - страница с формой изменения товара
pagesRouter.get("/products/:id/edit", function (request, response) {
    const product = models.findProduct(request.params.id);
    if (!product) return response.status(404).send("<h2>Товар не найден</h2><a href='/'>На главную</a>");
    response.render("product_form", {
        active: "catalog", heading: "Изменить товар", action: "/products/" + product.id + "/edit",
        categories: getCategories(), errors: [], values: product, currentImage: product.image_url
    });
});

// для проверки - сохранение изменений товара, новое фото заменяет старое
pagesRouter.post("/products/:id/edit", uploadPhoto, function (request, response) {
    const id = request.params.id;
    const product = models.findProduct(id);
    if (!product) return response.status(404).send("<h2>Товар не найден</h2><a href='/'>На главную</a>");
    const body = request.body || {};

    let errors = validateProduct(body);
    if (request.uploadError) errors.unshift(request.uploadError);
    if (errors.length === 0 && skuExists(body.sku, id)) errors = ["Товар с таким sku уже существует"];

    if (errors.length > 0) {
        if (request.file) removePhoto("/uploads/" + request.file.filename);
        return response.status(400).render("product_form", {
            active: "catalog", heading: "Изменить товар", action: "/products/" + id + "/edit",
            categories: getCategories(), errors: errors, values: body, currentImage: product.image_url
        });
    }
    const image = request.file ? "/uploads/" + request.file.filename : product.image_url;
    db.prepare(
        `UPDATE products SET name = ?, description = ?, price = ?, stock = ?, sku = ?, image_url = ?, category_id = ?
         WHERE id = ?`
    ).run(String(body.name).trim(), body.description || "", Number(body.price), Number(body.stock || 0),
          String(body.sku).trim(), image, body.category_id, id);
    if (request.file) removePhoto(product.image_url);

    response.redirect("/products/" + id);
});

// для проверки - удаление товара кнопкой, 409 если товар есть в заказах
pagesRouter.post("/products/:id/delete", function (request, response) {
    const product = models.findProduct(request.params.id);
    try {
        db.prepare("DELETE FROM products WHERE id = ?").run(request.params.id);
        if (product) removePhoto(product.image_url);
        response.redirect("/");
    } catch (error) {
        response.status(409).send("<h2>Нельзя удалить: товар есть в заказах</h2><a href='/'>На главную</a>");
    }
});

// для проверки - страница со списком заказов и доступными статусами
pagesRouter.get("/orders", function (_, response) {
    const orders = models.getAllOrders().map(function (order) {
        order.items = models.getOrder(order.id).items;
        order.next = models.nextStatuses[order.status];
        return order;
    });
    response.render("orders", { active: "orders", orders: orders });
});

// для проверки - смена статуса заказа из формы, затем возврат к списку заказов
pagesRouter.post("/orders/:id/status", urlencodedParser, function (request, response) {
    models.changeOrderStatus(request.params.id, request.body.status);
    response.redirect("/orders");
});

// для проверки - маршрут с двумя параметрами: категория и товар, перенаправляет на страницу товара
pagesRouter.get("/categories/:categoryId/products/:productId", function (request, response) {
    const catId = request.params["categoryId"];
    const prodId = request.params["productId"];
    const product = models.findProduct(prodId);
    if (!product || String(product.category_id) !== catId) {
        return response.status(404).send("Такого товара в этой категории нет");
    }
    response.redirect("/products/" + prodId);
});

module.exports = pagesRouter;

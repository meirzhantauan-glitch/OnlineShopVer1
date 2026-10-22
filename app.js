// для проверки - подключение библиотек и файлов с маршрутами
const express = require("express");
const fs = require("fs");
const path = require("path");

const productRouter = require("./routes/products");
const orderRouter = require("./routes/orders");
const { categoryRouter, customerRouter } = require("./routes/categories");
const pagesRouter = require("./routes/pages");

// для проверки - создание приложения и подключение шаблонов EJS
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// для проверки - логирование каждого запроса в консоль и в файл server.log
app.use(function (request, response, next) {
    const now = new Date();
    const data = `${now.toLocaleTimeString()} ${request.method} ${request.url}`;
    console.log(data);
    fs.appendFile("server.log", data + "\n", function (error) {
        if (error) return console.log(error);
    });
    next();
});

// для проверки - добавление заголовка X-Shop-Api ко всем запросам /api
app.use("/api", function (_, response, next) {
    response.set("X-Shop-Api", "student-project");
    next();
});

// для проверки - раздача статических файлов из папки public
app.use(express.static(path.join(__dirname, "public")));

// для проверки - разбор JSON из тела запроса
app.use(express.json());

// для проверки - подключение роутеров API
app.use("/api/products", productRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/customers", customerRouter);
app.use("/api/orders", orderRouter);

// для проверки - адреса /about и /abut отдают html-файл about.html
app.get("/abo?ut", function (_, response) {
    response.sendFile(__dirname + "/public/about.html");
});

// для проверки - адреса /shop и /shoop перенаправляют на главную
app.get("/sho+p", function (_, response) {
    response.redirect("/");
});

// для проверки - постоянное перенаправление (301) с /index.html на главную
app.get("/index.html", function (_, response) {
    response.redirect(301, "/");
});

// для проверки - короткая ссылка вида /p3 перенаправляет на /products/3
app.get(/^\/p(\d+)$/, function (request, response) {
    const id = request.params[0];
    response.redirect("/products/" + id);
});

// для проверки - /ping отвечает только статусом 200
app.get("/ping", function (_, response) {
    response.sendStatus(200);
});

// для проверки - подключение HTML-страниц магазина
app.use("/", pagesRouter);

// для проверки - ответ 404, если ни один маршрут не подошёл
app.use(function (request, response) {
    if (request.url.startsWith("/api")) {
        return response.status(404).json({ error: "Маршрут не найден", details: [] });
    }
    response.status(404).send("<h2>Страница не найдена</h2><a href='/'>На главную</a>");
});

// для проверки - общий обработчик ошибок, возвращает JSON с кодом ошибки
app.use(function (error, request, response, next) {
    if (error.type === "entity.parse.failed") {
        return response.status(400).json({ error: "Неверный формат JSON", details: [] });
    }
    const status = error.status || 500;
    if (status === 500) console.log(error);
    response.status(status).json({
        error: status === 500 ? "Внутренняя ошибка сервера" : error.message,
        details: error.details || []
    });
});

// для проверки - запуск сервера на порту 3000
app.listen(3000, function () {
    console.log("Сервер запущен: http://localhost:3000");
});

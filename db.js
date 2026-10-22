// для проверки - подключение к базе SQLite (файл shop.db) и включение внешних ключей
const Database = require("better-sqlite3");

const db = new Database("shop.db");
db.pragma("foreign_keys = ON");

// для проверки - создание таблиц, если их ещё нет
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    price       REAL NOT NULL CHECK (price > 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku         TEXT NOT NULL UNIQUE,
    image_url   TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name  TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    phone      TEXT,
    address    TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_cards (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id      INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    card_number      TEXT NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL DEFAULT 5 CHECK (discount_percent BETWEEN 0 AND 30)
);

CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status      TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','paid','shipped','delivered','cancelled')),
    total_price REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL
);
`);

// для проверки - тестовые данные: категории, товары и клиенты (добавляются, если база пустая)
const count = db.prepare("SELECT COUNT(*) AS n FROM categories").get().n;
if (count === 0) {
    const addCategory = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    addCategory.run("Электроника", "Телефоны, ноутбуки, наушники");
    addCategory.run("Книги", "Учебники и художественная литература");
    addCategory.run("Одежда", "Футболки, куртки, обувь");

    const addProduct = db.prepare(
        "INSERT INTO products (name, description, price, stock, sku, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    addProduct.run("Смартфон X10", "6.5 дюймов, 128 ГБ", 150000, 10, "EL-001", "/img/products/smartphone.svg", 1);
    addProduct.run("Наушники Pro", "Беспроводные", 25000, 25, "EL-002", "/img/products/headphones.svg", 1);
    addProduct.run("Ноутбук Air 14", "8 ГБ RAM, SSD 256 ГБ", 320000, 5, "EL-003", "/img/products/laptop.svg", 1);
    addProduct.run("Node.js для начинающих", "Учебник", 6500, 40, "BK-001", "/img/products/book-node.svg", 2);
    addProduct.run("Базы данных. SQL", "Учебник", 5500, 30, "BK-002", "/img/products/book-sql.svg", 2);
    addProduct.run("Футболка", "Хлопок, размер M", 4500, 50, "CL-001", "/img/products/tshirt.svg", 3);

    const addCustomer = db.prepare("INSERT INTO customers (full_name, email, phone, address) VALUES (?, ?, ?, ?)");
    addCustomer.run("Айдар Сейтов", "aidar@mail.kz", "+77011234567", "Алматы, ул. Абая 1");
    addCustomer.run("Айгерим Нурлан", "aigerim@mail.kz", "+77017654321", "Астана, пр. Республики 5");
}

// для проверки - картинки по умолчанию для тестовых товаров, у которых ещё нет фото
const defaultImages = {
    "EL-001": "smartphone", "EL-002": "headphones", "EL-003": "laptop",
    "BK-001": "book-node", "BK-002": "book-sql", "CL-001": "tshirt"
};
const setImage = db.prepare("UPDATE products SET image_url = ? WHERE sku = ? AND (image_url IS NULL OR image_url = '')");
Object.keys(defaultImages).forEach(function (sku) {
    setImage.run("/img/products/" + defaultImages[sku] + ".svg", sku);
});

// для проверки - карты лояльности для клиентов (связь 1:1)
const cards = db.prepare("SELECT COUNT(*) AS n FROM loyalty_cards").get().n;
if (cards === 0) {
    const customers = db.prepare("SELECT id FROM customers").all();
    const addCard = db.prepare("INSERT INTO loyalty_cards (customer_id, card_number, discount_percent) VALUES (?, ?, ?)");
    customers.forEach(function (c) {
        addCard.run(c.id, "KZ-" + String(c.id).padStart(5, "0"), 5);
    });
}

module.exports = db;

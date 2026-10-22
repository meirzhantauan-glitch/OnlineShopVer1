// для проверки - корзина (массив в памяти браузера) и ссылки на элементы страницы
let cart = [];

const cartPanel = document.getElementById("cart");
const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const cartCount = document.getElementById("cartCount");
const cartMessage = document.getElementById("cartMessage");
const customerSelect = document.getElementById("customerSelect");

// для проверки - открытие и закрытие панели корзины
document.getElementById("cartToggle").addEventListener("click", function () {
    cartPanel.classList.toggle("open");
});
document.getElementById("cartClose").addEventListener("click", function () {
    cartPanel.classList.remove("open");
});

// для проверки - отрисовка корзины: список товаров, итоговая сумма и счётчик
function renderCart() {
    cartList.innerHTML = "";
    let total = 0;
    let count = 0;
    cart.forEach(function (item) {
        const li = document.createElement("li");

        const text = document.createElement("span");
        text.textContent = item.name + " × " + item.quantity;
        li.appendChild(text);

        const removeBtn = document.createElement("button");
        removeBtn.className = "icon-btn";
        removeBtn.title = "Убрать";
        removeBtn.innerHTML = '<svg class="ic"><use href="/icons.svg#i-x"></use></svg>';
        removeBtn.addEventListener("click", function () {
            cart = cart.filter(function (c) { return c.id !== item.id; });
            renderCart();
        });
        li.appendChild(removeBtn);

        cartList.appendChild(li);
        total += item.price * item.quantity;
        count += item.quantity;
    });
    cartTotal.textContent = total;
    cartCount.textContent = count;
    cartCount.hidden = count === 0;
}

// для проверки - добавление товара в корзину по нажатию на кнопку "В корзину"
document.addEventListener("click", function (e) {
    const button = e.target.closest(".add-to-cart");
    if (!button) return;

    const id = Number(button.dataset.id);
    const found = cart.find(function (item) { return item.id === id; });
    if (found) {
        found.quantity++;
    } else {
        cart.push({ id: id, name: button.dataset.name, price: Number(button.dataset.price), quantity: 1 });
    }
    cartMessage.textContent = "";
    renderCart();
});

// для проверки - AJAX GET: загрузка списка клиентов в выпадающий список
async function loadCustomers() {
    const response = await fetch("/api/customers");
    const customers = await response.json();
    customers.forEach(function (c) {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.full_name;
        customerSelect.appendChild(option);
    });
}

// для проверки - AJAX POST: отправка заказа в формате JSON и показ ответа сервера
document.getElementById("checkoutBtn").addEventListener("click", async function () {
    if (cart.length === 0) {
        cartMessage.textContent = "Корзина пуста";
        return;
    }
    const order = {
        customerId: Number(customerSelect.value),
        items: cart.map(function (item) { return { productId: item.id, quantity: item.quantity }; })
    };

    const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order)
    });
    const data = await response.json();

    if (response.ok) {
        cartMessage.textContent = "Заказ №" + data.id + " создан! Сумма: " + data.total_price + " тг";
        cart = [];
        renderCart();
    } else {
        cartMessage.textContent = data.error + (data.details && data.details.length ? ": " + data.details.join(", ") : "");
    }
});

// для проверки - первоначальная загрузка клиентов и отрисовка пустой корзины
loadCustomers();
renderCart();

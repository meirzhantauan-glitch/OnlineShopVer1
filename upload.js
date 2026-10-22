const multer = require("multer");
const path = require("path");
const fs = require("fs");

// для проверки - папка для загруженных фото, создаётся автоматически
const uploadDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// для проверки - допустимые типы фото и их расширения
const extByType = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// для проверки - настройка multer: куда сохранять и как называть файл
const storage = multer.diskStorage({
    destination: function (request, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (request, file, cb) {
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1e6) + extByType[file.mimetype]);
    }
});

// для проверки - ограничения: размер до 2 МБ и только JPG, PNG, WEBP
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: function (request, file, cb) {
        if (extByType[file.mimetype]) cb(null, true);
        else cb(new Error("Разрешены только фото JPG, PNG или WEBP"));
    }
});

// для проверки - принимает одно фото из поля photo, ошибку загрузки кладёт в request.uploadError
function uploadPhoto(request, response, next) {
    upload.single("photo")(request, response, function (error) {
        if (error) {
            request.uploadError = error.code === "LIMIT_FILE_SIZE" ? "Фото должно быть не больше 2 МБ" : error.message;
        }
        next();
    });
}

// для проверки - удаляет файл фото, только из папки uploads
function removePhoto(url) {
    if (!url || !url.startsWith("/uploads/")) return;
    fs.unlink(path.join(uploadDir, path.basename(url)), function () {});
}

module.exports = { uploadPhoto, removePhoto };

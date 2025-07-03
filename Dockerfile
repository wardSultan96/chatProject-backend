FROM node:18-alpine AS builder

WORKDIR /app

# 1. نسخ ملفات التبعية فقط أولاً
COPY package*.json ./
COPY tsconfig*.json ./

# 2. تثبيت كل التبعيات (بما فيها devDependencies) للبناء
RUN npm ci

# 3. نسخ باقي الملفات
COPY src ./src

# 4. بناء التطبيق
RUN npm run build

# ----------------------------
# مرحلة الإنتاج النهائية
# ----------------------------
FROM node:18-alpine

WORKDIR /app

# 5. نسخ فقط ما هو ضروري للإنتاج
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 6. تنظيف تبعيات التطوير غير الضرورية
RUN npm prune --production

# 7. الأمان: تشغيل كخدمة غير root
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
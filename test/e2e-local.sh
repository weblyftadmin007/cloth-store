#!/usr/bin/env bash
# ============================================================
# Local end-to-end test for the cloth store
# Boots `wrangler pages dev`, runs HTTP tests, shuts down.
# Usage: bash test/e2e-local.sh
# ============================================================
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="http://localhost:8788"
LOG=/tmp/wrangler-dev.log
COOKIES=/tmp/e2e-cookies.txt
PASS=0; FAIL=0

ok()  { echo "PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }

# JSON getter: echo body | jget '.products.length'
jget() {
  node "$SCRIPT_DIR/jget.mjs" "$1" 2>/dev/null
}

cleanup() {
  pkill -f "wrangler pages dev" 2>/dev/null
  rm -f "$COOKIES"
}
trap cleanup EXIT

echo "== Reseeding local D1 for a deterministic run =="
npx wrangler d1 execute cloth-store-db --local --file=./schema.sql > /dev/null 2>&1

echo "== Booting wrangler pages dev =="
rm -f "$LOG" "$COOKIES"
npx wrangler pages dev public --port 8788 > "$LOG" 2>&1 &
sleep 2

READY=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/config" 2>/dev/null)
  if [ "$code" = "200" ]; then READY=1; echo "Server ready after ~$((i+2))s"; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "SERVER FAILED TO START — log:"
  cat "$LOG"
  exit 1
fi

echo ""
echo "== 1. Static storefront pages =="
for path in / /shop /product /cart /checkout /order-success /admin/; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$path")
  [ "$code" = "200" ] && ok "GET $path -> 200" || bad "GET $path -> $code (expected 200)"
done
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/shop.html")
[ "$code" = "308" ] && ok "legacy /shop.html 308-redirects to clean URL" || bad "legacy .html -> $code (expected 308)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/index.html")
[ "$code" = "308" ] && ok "pretty-URL redirect for /admin/index.html" || bad "/admin/index.html -> $code (expected 308)"
body=$(curl -s "$BASE/")
echo "$body" | grep -q '</html>' && ok "home page renders full HTML" || bad "home page HTML truncated"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/assets/p/classic-cotton-tee.svg")
[ "$code" = "200" ] && ok "product placeholder SVG served" || bad "placeholder SVG -> $code"

echo ""
echo "== 2. Public API: products + config =="
body=$(curl -s "$BASE/api/products")
count=$(echo "$body" | jget '.products.length')
[ "$count" = "29" ] && ok "GET /api/products -> 29 seeded products" || bad "product count $count (expected 29)"
cats=$(echo "$body" | jget '.categories.join(",")')
echo "$cats" | grep -q "Tees" && echo "$cats" | grep -q "Accessories" \
  && ok "categories present ($cats)" || bad "categories missing: $cats"

count=$(curl -s "$BASE/api/products?category=Jackets" | jget '.products.length')
[ "$count" = "5" ] && ok "category filter Jackets -> 5" || bad "Jackets filter -> $count (expected 5)"

count=$(curl -s "$BASE/api/products?q=hoodie" | jget '.products.length')
[ "$count" -ge 5 ] 2>/dev/null && ok "search q=hoodie -> $count results" || bad "search hoodie -> $count (expected >= 5)"

body=$(curl -s "$BASE/api/products?slug=logo-cap")
name=$(echo "$body" | jget '.name'); price=$(echo "$body" | jget '.price'); sizes=$(echo "$body" | jget '.sizes.length')
{ [ "$name" = "Logo Cap" ] && [ "$price" = "59900" ] && [ "$sizes" = "1" ]; } \
  && ok "slug lookup returns product with paise price + sizes" || bad "slug lookup: name=$name price=$price sizes=$sizes"

val=$(curl -s "$BASE/api/products?slug=nope-nope" | jget '')
[ "$val" = "null" ] && ok "unknown slug -> null" || bad "unknown slug -> $val"

body=$(curl -s "$BASE/api/config")
brand=$(echo "$body" | jget '.brand');  hero=$(echo "$body" | jget '.heroTitle')
{ [ "$brand" = "Your Brand" ] && [ -n "$hero" ] && [ "$hero" != "undefined" ]; } \
  && ok "GET /api/config -> brand + hero settings" || bad "config: brand=$brand hero=$hero"

echo ""
echo "== 3. Admin auth =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/products")
[ "$code" = "401" ] && ok "admin API without session -> 401" || bad "unauthed admin API -> $code (expected 401)"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/login" -H 'content-type: application/json' -d '{"password":"wrong"}')
[ "$code" = "401" ] && ok "login with wrong password -> 401" || bad "wrong password -> $code (expected 401)"

resp=$(curl -s -i -c "$COOKIES" -X POST "$BASE/api/login" -H 'content-type: application/json' -d '{"password":"admin-test-1234"}')
echo "$resp" | grep -qi 'set-cookie: admin_session=' && ok "login sets admin_session cookie" || bad "no session cookie in login response"
echo "$resp" | head -1 | grep -q ' 200' && ok "login with correct password -> 200" || bad "login status: $(echo "$resp" | head -1)"

code=$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' "$BASE/api/me")
[ "$code" = "200" ] && ok "GET /api/me with cookie -> 200" || bad "/api/me -> $code (expected 200)"

echo ""
echo "== 4. Admin CRUD: products =="
body=$(curl -s -b "$COOKIES" "$BASE/api/admin/products")
count=$(echo "$body" | jget '.products.length')
[ "$count" = "29" ] && ok "GET /api/admin/products -> 29 (incl. inactive)" || bad "admin products -> $count"

RAND=$RANDOM
NAME="Test Kurta $RAND"
SLUG="test-kurta-$RAND"
body=$(curl -s -b "$COOKIES" -X POST "$BASE/api/admin/products" -H 'content-type: application/json' \
  -d "{\"name\":\"$NAME\",\"price\":1299,\"category\":\"Shirts\",\"sizes\":[\"S\",\"M\",\"L\"],\"colors\":[\"Indigo\"],\"stock\":7,\"description\":\"E2E test product\",\"featured\":false}")
pid=$(echo "$body" | jget '.product.id'); pslug=$(echo "$body" | jget '.product.slug'); pprice=$(echo "$body" | jget '.product.price')
case "$pslug" in test-kurta-*) : ;; *) pslug="BAD:$pslug" ;; esac
{ [ "$pprice" = "129900" ] && [ "$pid" != "null" ] && [ -n "$pid" ]; } \
  && ok "POST create product -> id=$pid slug=$pslug price stored in paise" || bad "create: id=$pid slug=$pslug price=$pprice"

count=$(curl -s "$BASE/api/products" | jget '.products.length')
[ "$count" = "30" ] && ok "new product immediately live on storefront (30)" || bad "storefront count $count (expected 30)"

body=$(curl -s -b "$COOKIES" -X PUT "$BASE/api/admin/products/$pid" -H 'content-type: application/json' \
  -d '{"price":1499,"stock":3}')
nprice=$(echo "$body" | jget '.product.price'); nstock=$(echo "$body" | jget '.product.stock')
{ [ "$nprice" = "149900" ] && [ "$nstock" = "3" ]; } && ok "PUT update price + stock" || bad "update: price=$nprice stock=$nstock"

price=$(curl -s "$BASE/api/products?slug=$SLUG" | jget '.price')
[ "$price" = "149900" ] && ok "update visible on public API" || bad "public price after update: $price"

code=$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/products" -H 'content-type: application/json' -d "{\"name\":\"$NAME\",\"price\":10}")
[ "$code" = "400" ] && ok "duplicate slug rejected -> 400" || bad "duplicate create -> $code (expected 400)"

echo ""
echo "== 5. Upload + media serving =="
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n\x2d\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/e2e-test.png
body=$(curl -s -b "$COOKIES" -F "file=@/tmp/e2e-test.png;type=image/png" "$BASE/api/admin/upload")
url=$(echo "$body" | jget '.url')
case "$url" in /media/products/*) ok "upload -> $url";; *) bad "upload url: $url";; esac
ct=$(curl -s -o /dev/null -w '%{content_type}' "$BASE$url")
echo "$ct" | grep -q 'image/png' && ok "GET $url serves image/png from R2" || bad "media content-type: $ct"

echo ""
echo "== 6. Admin settings -> live on storefront =="
code=$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/admin/settings" -H 'content-type: application/json' -d '{"brand":"Test Brand Co"}')
[ "$code" = "200" ] && ok "PUT /api/admin/settings -> 200" || bad "settings PUT -> $code"
brand=$(curl -s "$BASE/api/config" | jget '.brand')
[ "$brand" = "Test Brand Co" ] && ok "storefront /api/config reflects new brand instantly" || bad "config brand: $brand"
curl -s -b "$COOKIES" -X PUT "$BASE/api/admin/settings" -H 'content-type: application/json' -d '{"brand":"Your Brand"}' > /dev/null

echo ""
echo "== 7. Admin orders =="
body=$(curl -s -b "$COOKIES" "$BASE/api/admin/orders")
count=$(echo "$body" | jget '.orders.length')
[ "$count" = "0" ] && ok "GET /api/admin/orders -> empty list" || bad "orders count: $count"

echo ""
echo "== 8. Checkout API (create-order validation) =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/create-order" -H 'content-type: application/json' -d '{"items":[],"customer":{"name":"A","phone":"9999999999"}}')
[ "$code" = "400" ] && ok "empty cart -> 400" || bad "empty cart -> $code (expected 400)"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/create-order" -H 'content-type: application/json' -d '{"items":[{"slug":"classic-cotton-tee","qty":1}],"customer":{}}')
[ "$code" = "400" ] && ok "missing customer name/phone -> 400" || bad "missing customer -> $code (expected 400)"

body=$(curl -s -X POST "$BASE/api/create-order" -H 'content-type: application/json' \
  -d '{"items":[{"slug":"leather-biker-jacket","qty":10}],"customer":{"name":"T","phone":"9999999999"}}')
err=$(echo "$body" | jget '.error')
echo "$err" | grep -qi "left in stock" && ok "overselling blocked: $err" || bad "stock check: $err"

# Razorpay call with fake local creds must fail cleanly (502), not crash
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/create-order" -H 'content-type: application/json' \
  -d '{"items":[{"slug":"classic-cotton-tee","size":"M","qty":2}],"customer":{"name":"Test User","phone":"9999999999"}}')
[ "$code" = "502" ] && ok "create-order with invalid Razorpay keys -> clean 502 (no crash)" || bad "razorpay failure path -> $code (expected 502)"
count=$(curl -s -b "$COOKIES" "$BASE/api/admin/orders" | jget '.orders.length')
[ "$count" = "0" ] && ok "no orphan order saved when payment creation fails" || bad "orders saved on failure: $count"

echo ""
echo "== 9. Media 404 + logout =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/media/products/does-not-exist.png")
[ "$code" = "404" ] && ok "missing media -> 404" || bad "missing media -> $code"

code=$(curl -s -b "$COOKIES" -c "$COOKIES" -o /dev/null -w '%{http_code}' -X POST "$BASE/api/logout")
[ "$code" = "200" ] && ok "logout -> 200" || bad "logout -> $code"
code=$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' "$BASE/api/me")
[ "$code" = "401" ] && ok "session invalidated after logout" || bad "me after logout -> $code (expected 401)"

echo ""
echo "== 10. Cleanup test data =="
code=$(curl -s -c "$COOKIES" -X POST "$BASE/api/login" -H 'content-type: application/json' -d '{"password":"admin-test-1234"}' -o /dev/null -w '%{http_code}')
if [ "$pid" -eq "$pid" ] 2>/dev/null; then
  code=$(curl -s -b "$COOKIES" -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/admin/products/$pid")
  [ "$code" = "200" ] && ok "test product deleted" || bad "delete -> $code"
  count=$(curl -s "$BASE/api/products" | jget '.products.length')
  [ "$count" = "29" ] && ok "catalog back to 29" || bad "final count $count"
else
  bad "skipped cleanup — no valid product id (create failed)"
fi

echo ""
echo "=================================="
echo "RESULT: $PASS passed, $FAIL failed"
echo "=================================="
[ "$FAIL" = "0" ]

# Costco Order Assistant

A userscript for costco.com that synchronizes orders locally, finds historical orders by product, checks whether recently purchased products have dropped in price, and warns when watched products go on sale. All order and product caches remain in your browser and are never uploaded to a third-party service.

## Features

### Find Orders

- Find orders by product name, order item description, or exact item number.
- Product names support case-insensitive, partial keyword matching. For example, `dar chi` matches `Dark Baking Chip`.
- Results are sorted from newest to oldest.
- View every item in an order, including item numbers, historical purchase prices, and discounts.

### 30-Day Price Adjustment

- Find in-warehouse purchases from the last 30 days that may be eligible for a Costco price adjustment.
- Compare each item's discounted purchase price with its latest `listPrice`.
- Automatically skip refunds, weighted items, discontinued or unavailable products, and items that have not dropped in price.
- Group eligible items by order and show the item number, original purchase amount, discount, discounted old price, and new price.

### Price Watch

- Maintain a personal watchlist of up to 50 products to monitor for price drops, added and removed by item number.
- Each entry shows the item number, name, regular price, and the current price when it is lower than usual.
- Discounted items are highlighted, and the feature button in the picker shows a badge with the number of watched items currently on sale.
- Watched items are refreshed on every **Start** sync so their prices and the badge stay up to date.

### Local Data Sync

When you click **Start**, the script incrementally synchronizes in-warehouse orders and product details before showing the feature picker. The first run retrieves orders from the last five years. Later runs retrieve only orders since the last successful sync and refresh prices for recently purchased products.

## Usage

Before using the script, sign in to [costco.com](https://www.costco.com/) and open **Account > Orders & Purchases** so the script can access your Costco session information.

### Desktop Browsers

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
2. Open the [latest userscript](https://github.com/LJ-works/costco-receipts/releases/latest/download/costco-userjs.user.js) and confirm the installation in your userscript manager.
3. Sign in to costco.com and open **Account > Orders & Purchases**.
4. Click **Start** in the bottom-right corner of the page.
5. Wait for synchronization to finish, then choose **Find Orders**, **30-Day Price Adjustment**, or **Price Watch**.

### iPhone and iPad

This setup requires iOS or iPadOS 15.1 or later and Safari.

1. Install [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) from the App Store.
2. Open the Userscripts app. Recent versions create a default scripts directory automatically. If prompted, tap **Set Userscripts Directory** and select a directory.
3. Enable Userscripts under **Safari > Extensions** in the Settings app. You can also manage it from Safari's `AA` or extensions button. For the best experience, grant Userscripts **Always Allow** access to **All Websites**.
4. Tap the [latest userscript](https://github.com/LJ-works/costco-receipts/releases/latest/download/costco-userjs.user.js) link in Safari to download the file.
5. Save the downloaded file into the Userscripts directory you selected in step 2.
6. Sign in to costco.com and open **Account > Orders & Purchases**.
7. Tap **Start** in the bottom-right corner, wait for synchronization to finish, and select a feature.

Alternatively, save the downloaded `costco-userjs.user.js` file directly in the scripts directory used by the Userscripts app.

## Updating

Open the [latest userscript](https://github.com/LJ-works/costco-receipts/releases/latest/download/costco-userjs.user.js) and confirm the installation again in your userscript manager to update to the latest version.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, building, and release instructions.

# Costco Order Assistant

A userscript for costco.com that synchronizes orders locally, finds historical orders by product, checks whether recently purchased products match current Warehouse Savings offers, and warns when watched products appear in the active Warehouse Savings campaign. All local caches remain in your browser and are never uploaded to a third-party service.

## Features

### Find Orders

- Find orders by product name, order item description, or exact item number.
- Product names support case-insensitive, partial keyword matching. For example, `dar chi` matches `Dark Baking Chip`.
- Results are sorted from newest to oldest.
- View every item in an order, including item numbers, historical purchase prices, and discounts.

### 30-Day Price Adjustment

- Find in-warehouse purchases from the last 30 days that may be eligible for a Costco price adjustment.
- Compare purchases with warehouse-applicable offers published on Costco's Warehouse Savings page.
- Use exact campaign prices where available. For `Save $X` offers, estimate the new price from the receipt's gross price and compare the campaign saving with any discount already received.
- Automatically skip refunds, weighted items, products absent from the current campaign, online-only offers, and ambiguous price ranges or incentives.
- Group eligible items by order and clearly label saving-only calculations as estimates.

### Price Watch

- Maintain a personal watchlist of up to 50 products to monitor for price drops, added and removed by item number.
- Watched items appearing in the current warehouse-applicable Warehouse Savings campaign are highlighted and show the published offer text.
- The feature button badge counts watched items in that campaign.
- Items absent from the campaign remain on the watchlist for future promotions but are not marked as on sale.
- Product API prices are not displayed as current warehouse deal prices.

### Local Data Sync

When you click **Start**, the script incrementally synchronizes in-warehouse orders and missing product metadata before showing the feature picker. The first run retrieves orders from the last five years; later runs retrieve only orders since the last successful sync. Costco's Warehouse Savings page is fetched fresh once per run for active deal information.

## Pricing data source

Warehouse deal decisions use Costco's customer-facing Warehouse Savings page, not the product GraphQL API's `price` or `listPrice`. During validation, 212 page deals were comparable with the product API, but 20 had different prices and 53 had unavailable API pricing. That error rate is not reliable enough for price-adjustment or sale-warning decisions.

The product API may still supply descriptive metadata such as names and images, but its prices are not treated as authoritative and are never used as a fallback when Warehouse Savings is unavailable.

Warehouse Savings also has limitations: it covers campaign items rather than the full catalog; prices may vary by location and in AK, HI, PR, Business Centers, and online; and some offers provide only a saving, range, or incentive. Items absent from the page are deliberately skipped. A `Save $X` price-adjustment estimate assumes the receipt's gross price remains the applicable base price.

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

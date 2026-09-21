<#
Push this theme's code to the Shopify draft theme (theme id: 161185300726).

Only pushes code directories: layout/, sections/, snippets/, assets/,
config/settings_schema.json, locales/en.default.json.
Deliberately excludes config/settings_data.json (merchant-managed
operational config) so live/draft settings data is never overwritten.

Usage:
  .\push-theme.ps1
  .\push-theme.ps1 -Store other-store.myshopify.com   # override the default store
#>

param(
    [string]$Store = "moody-tiger-athletics.myshopify.com"
)

$ThemeId = "161784496374"

$shopifyArgs = @(
    "theme", "push",
    "--theme", $ThemeId,
    "--store", $Store,
    "--only", "layout/*",
    "--only", "sections/*",
    "--only", "snippets/*",
    "--only", "assets/*",
    "--only", "config/settings_schema.json",
    "--only", "locales/en.default.json"
)

Write-Host "Pushing to draft theme $ThemeId on $Store (layout/sections/snippets/assets/settings_schema.json/locales/en.default.json only, settings_data.json excluded)..."
shopify @shopifyArgs

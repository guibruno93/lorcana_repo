# 🔧 AUTOMATED HEURISTICS DEBUG
# Runs inspector on multiple decks and summarizes findings

Write-Host @"

╔═══════════════════════════════════════════════════╗
║   🔧 HEURISTICS DEBUG AUTOMATION 🔧              ║
╚═══════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$PROJECT_PATH = "S:\INKREC\lorcana_ai\backend\scripts"

# Test URLs from previous scrapes
$TEST_URLS = @(
    "https://inkdecks.com/lorcana-metagame/deck-cory-bs-508281",
    "https://inkdecks.com/lorcana-metagame/deck-jasmin-s-allies-508276",
    "https://inkdecks.com/lorcana-metagame/deck-queen-burning-508275"
)

Push-Location $PROJECT_PATH

Write-Host "`n📋 Testing $($TEST_URLS.Count) deck URLs...`n" -ForegroundColor Yellow

$results = @()

foreach ($url in $TEST_URLS) {
    $deckName = $url -replace '.*deck-(.+)-\d+$', '$1'
    
    Write-Host "🔍 Testing: $deckName" -ForegroundColor Cyan
    Write-Host "   URL: $url" -ForegroundColor Gray
    
    # Run inspector
    $output = node debug-inkdecks-inspector.js $url 2>&1 | Out-String
    
    # Parse results
    $result = @{
        deck = $deckName
        url = $url
        has_record = $false
        has_standing = $false
        has_event = $false
        patterns_found = @()
        relevant_lines = @()
    }
    
    # Check for patterns
    if ($output -match "W-L Record.*?→") {
        $result.has_record = $true
        $result.patterns_found += "W-L Record"
    }
    
    if ($output -match "Standing.*?→") {
        $result.has_standing = $true
        $result.patterns_found += "Standing"
    }
    
    if ($output -match "Top N.*?→") {
        $result.has_standing = $true
        $result.patterns_found += "Top N"
    }
    
    # Extract relevant lines
    $relevantSection = $output -match "(?s)RELEVANT TEXT SECTIONS.*?(?=═{3,}|$)"
    if ($matches) {
        $lines = $matches[0] -split "`n" | Where-Object { $_ -match "^\d+\." }
        $result.relevant_lines = $lines
    }
    
    $results += $result
    
    if ($result.patterns_found.Count -gt 0) {
        Write-Host "   ✅ Found: $($result.patterns_found -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "   ❌ No patterns found" -ForegroundColor Red
    }
    
    Write-Host ""
}

Pop-Location

# ═══════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════

Write-Host @"

╔═══════════════════════════════════════════════════╗
║              📊 SUMMARY 📊                        ║
╚═══════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$totalDecks = $results.Count
$decksWithRecord = ($results | Where-Object { $_.has_record }).Count
$decksWithStanding = ($results | Where-Object { $_.has_standing }).Count

Write-Host "Decks tested: $totalDecks" -ForegroundColor White
Write-Host "Decks with W-L record: $decksWithRecord/$totalDecks ($([math]::Round($decksWithRecord/$totalDecks*100, 0))%)" -ForegroundColor $(
    if ($decksWithRecord -eq $totalDecks) { "Green" }
    elseif ($decksWithRecord -ge $totalDecks * 0.6) { "Yellow" }
    else { "Red" }
)
Write-Host "Decks with standing: $decksWithStanding/$totalDecks ($([math]::Round($decksWithStanding/$totalDecks*100, 0))%)" -ForegroundColor $(
    if ($decksWithStanding -eq $totalDecks) { "Green" }
    elseif ($decksWithStanding -ge $totalDecks * 0.6) { "Yellow" }
    else { "Red" }
)

Write-Host ""

# Recommendations
if ($decksWithRecord -eq $totalDecks -and $decksWithStanding -ge $totalDecks * 0.6) {
    Write-Host @"
✅ EXCELLENT! Patterns are working!

Next steps:
1. Test with 5 decks using the scraper:
   node scripts/local-scraper.js 5
   
2. If 3+ decks have W-L data, proceed with 100-deck scrape
3. GitHub Actions → Scrape Inkdecks Decks → limit 100

"@ -ForegroundColor Green

} elseif ($decksWithRecord -ge $totalDecks * 0.6) {
    Write-Host @"
⚠️  PARTIAL SUCCESS - Some patterns working

Next steps:
1. Review individual deck outputs above
2. Check if missing decks truly have no data
3. Test with scraper: node scripts/local-scraper.js 5
4. If acceptable, proceed with 100-deck scrape

Note: It's OK if some decks don't have performance data!
The tier list will work with whatever data is available.

"@ -ForegroundColor Yellow

} else {
    Write-Host @"
❌ PATTERNS NOT WORKING

Action required:
1. Review full inspector output for each deck
2. Look at RELEVANT TEXT SECTIONS in the output
3. Check if Inkdecks actually has performance data
4. If data exists but patterns don't match:
   - Update extractDeckPagePerformance() patterns
   - Follow GUIA_AJUSTAR_HEURISTICAS.md
5. If data doesn't exist on Inkdecks:
   - That's OK! System works without it
   - Tier list will be based on meta share only
   - Proceed with 100-deck scrape

"@ -ForegroundColor Red
}

Write-Host "═══════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Detailed results
Write-Host "📋 Detailed Results:`n" -ForegroundColor Cyan

foreach ($result in $results) {
    Write-Host "Deck: $($result.deck)" -ForegroundColor White
    Write-Host "  URL: $($result.url)" -ForegroundColor Gray
    
    if ($result.patterns_found.Count -gt 0) {
        Write-Host "  ✅ Patterns: $($result.patterns_found -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "  ❌ No patterns found" -ForegroundColor Red
    }
    
    if ($result.relevant_lines.Count -gt 0) {
        Write-Host "  📝 Relevant lines:" -ForegroundColor Cyan
        $result.relevant_lines | Select-Object -First 3 | ForEach-Object {
            Write-Host "     $_" -ForegroundColor Gray
        }
        if ($result.relevant_lines.Count -gt 3) {
            Write-Host "     ... (and $($result.relevant_lines.Count - 3) more)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  ⚠️  No relevant text found" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host @"

💡 TIP: For detailed output of any deck, run:
   node debug-inkdecks-inspector.js <url>

"@ -ForegroundColor Gray

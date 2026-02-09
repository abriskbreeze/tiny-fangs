#!/bin/bash
# Version bump script for Tiny Fangs
# Usage: ./scripts/bump.sh 0.4.4 "Description of changes"

set -e

VERSION="$1"
DESCRIPTION="$2"
DATE=$(date +%Y-%m-%d)

if [ -z "$VERSION" ] || [ -z "$DESCRIPTION" ]; then
  echo "Usage: ./scripts/bump.sh <version> <description>"
  echo "Example: ./scripts/bump.sh 0.4.4 'Fixed AI healing verse bug'"
  exit 1
fi

echo "🔄 Bumping to v$VERSION..."

# 1. VERSION file
echo "v$VERSION" > VERSION
echo "  ✓ VERSION"

# 2. package.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
echo "  ✓ package.json"

# 3. README.md
sed -i '' "s/\*\*v[0-9.]*\*\*/\*\*v$VERSION\*\*/" README.md
echo "  ✓ README.md"

# 4. index.html (setup screen version + page title + desktop header)
sed -i '' "s/v[0-9.]* • Card Battler/v$VERSION • Card Battler/" index.html
sed -i '' "s/<title>TINY FANGS v[0-9.]*<\/title>/<title>TINY FANGS v$VERSION<\/title>/" index.html
sed -i '' "s/TINY FANGS v[0-9.]*<\/div>/TINY FANGS v$VERSION<\/div>/" index.html
echo "  ✓ index.html"

# 5. CHANGELOG.md (prepend new entry)
CHANGELOG_ENTRY="## [$VERSION] - $DATE

### Changed
- $DESCRIPTION

---

"

# Create temp file with new entry + existing content (skip first 4 lines which are header)
{
  head -4 CHANGELOG.md
  echo ""
  echo "$CHANGELOG_ENTRY"
  tail -n +6 CHANGELOG.md
} > CHANGELOG.tmp && mv CHANGELOG.tmp CHANGELOG.md
echo "  ✓ CHANGELOG.md"

echo ""
echo "✅ Version bumped to v$VERSION"
echo "   Run 'npm run deploy' to build and push"

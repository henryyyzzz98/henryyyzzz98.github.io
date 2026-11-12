{
echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PitWall — F1 Team Manager</title>'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Titillium+Web:ital,wght@0,400;0,600;0,700;0,900;1,900&display=swap" rel="stylesheet">'
echo '<style>'; cat style.css; echo '</style></head><body><div id="app"></div><script>'
cat data.js engine.js hist.js timeline.js tracer.js app.js studio.js
echo '</script></body></html>'
} > ../index.html

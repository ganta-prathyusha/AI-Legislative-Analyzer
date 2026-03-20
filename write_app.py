code = open("app_source.js", "r", encoding="utf-8").read()
with open("app.js", "w", encoding="utf-8") as f:
    f.write(code)
import os
print("Written:", os.path.getsize("app.js"), "bytes")

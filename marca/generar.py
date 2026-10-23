"""
Genera todas las imágenes de marca a partir de los SVG de esta carpeta.

    python marca/generar.py

Rasteriza con Chrome sin ventana (ya está instalado y dibuja SVG y fuentes web
igual que el navegador), así no hace falta instalar nada. Si cambias el
isotipo, cambia isotipo.svg y vuelve a correr esto: los íconos de la app, el
splash, el favicon y las imágenes de la web salen de aquí.

Las formas y colores vienen de la hoja de marca (encargalo/branding): la bolsa
y el check, en Monte, Terracota, Trigo y Arena.
"""
import re
import subprocess
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

MONTE, TERRACOTA, TRIGO, ARENA = "#14352B", "#C65A3A", "#D9B45A", "#F2EBE1"
BOLSA = "M30 50 h60 l5 50 a7 7 0 0 1 -7 8 h-56 a7 7 0 0 1 -7 -8 Z"
CHECK = "M38 56 L54 74 L88 24"

# Ícono de la aplicación: cuadrado Monte, bolsa llena, check Terracota.
ISOTIPO = (AQUI / "isotipo.svg").read_text(encoding="utf-8")
# El dibujo sin el cuadrado de fondo: para el ícono adaptable de Android, que
# pone el fondo Monte por su cuenta.
SOLO_DIBUJO = re.sub(r'<rect width="512" height="512"[^>]*/>', "", ISOTIPO)


def simbolo(bolsa: str, check: str) -> str:
    """El símbolo de contorno (cabeceras, splash): bolsa trazada y check."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">'
        f'<path d="{BOLSA}" stroke="{bolsa}" stroke-width="8" stroke-linejoin="round"/>'
        f'<path d="{CHECK}" stroke="{check}" stroke-width="10" stroke-linecap="round"'
        ' stroke-linejoin="round"/></svg>'
    )


# Sobre claro el check va Terracota; sobre oscuro, Trigo. Nunca Trigo sobre claro.
SIMBOLO_CLARO = simbolo(MONTE, TERRACOTA)
SIMBOLO_OSCURO = simbolo(ARENA, TRIGO)

# Silueta en un solo color: Android la usa en los íconos temáticos y solo mira
# la transparencia. La bolsa llena lleva recortado un aire alrededor del check
# (máscara), y el check se dibuja encima: así se sigue leyendo en un color.
MONOCROMO = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    '<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">'
    '<rect width="120" height="120" fill="#FFF"/>'
    f'<path d="{CHECK}" fill="none" stroke="#000" stroke-width="23" stroke-linecap="round"'
    ' stroke-linejoin="round"/></mask>'
    '<g transform="translate(93 93) scale(2.7167)">'
    f'<path d="{BOLSA}" fill="#FFF" mask="url(#m)"/>'
    f'<path d="{CHECK}" fill="none" stroke="#FFF" stroke-width="11" stroke-linecap="round"'
    ' stroke-linejoin="round"/></g></svg>'
)


def png(html: str, destino: Path, ancho: int, alto: int, transparente=True):
    """Dibuja un HTML a PNG del tamaño exacto."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False,
                                     encoding="utf-8") as f:
        f.write(html)
        origen = f.name
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={ancho},{alto}",
        "--default-background-color=" + ("00000000" if transparente else "ffffffff"),
        "--virtual-time-budget=3000",
        f"--screenshot={destino}", Path(origen).as_uri(),
    ], check=True, capture_output=True)
    Path(origen).unlink()
    print("  ", destino.relative_to(RAIZ))


def lienzo(svg: str, lado: int, escala=1.0, fondo="transparent"):
    tam = int(lado * escala)
    return (f'<html><body style="margin:0;width:{lado}px;height:{lado}px;'
            f'background:{fondo};display:grid;place-items:center">'
            f'<div style="width:{tam}px;height:{tam}px">'
            + svg.replace("<svg ", '<svg width="100%" height="100%" ', 1)
            + "</div></body></html>")


def pagina(nombre: str, ancho: int, alto: int, destino: Path):
    """Las piezas grandes (banners, imagen para redes) son HTML."""
    html = (AQUI / nombre).read_text(encoding="utf-8")
    html = html.replace("{{SIMBOLO_OSCURO}}", SIMBOLO_OSCURO.replace(
        "<svg ", '<svg width="100%" height="100%" ', 1))
    png(html, destino, ancho, alto, transparente=False)


if __name__ == "__main__":
    img = RAIZ / "assets" / "images"
    web = RAIZ / "web" / "img"
    print("App:")
    png(lienzo(ISOTIPO, 1024), img / "icon.png", 1024, 1024)
    # Android recorta el ícono adaptable a un círculo del 66 % central; el
    # dibujo ya ocupa el 64 % del cuadrado, así que entra tal cual.
    png(lienzo(SOLO_DIBUJO, 1024), img / "android-icon-foreground.png", 1024, 1024)
    png(lienzo("", 1024, fondo=MONTE), img / "android-icon-background.png", 1024, 1024)
    png(lienzo(MONOCROMO, 1024), img / "android-icon-monochrome.png", 1024, 1024)
    # El splash va sobre Monte (app.json): símbolo de contorno en Arena y Trigo.
    png(lienzo(SIMBOLO_OSCURO, 512), img / "splash-icon.png", 512, 512)
    png(lienzo(ISOTIPO, 48), img / "favicon.png", 48, 48)

    print("Web:")
    png(lienzo(ISOTIPO, 180), web / "apple-touch-icon.png", 180, 180)
    png(lienzo(ISOTIPO, 32), web / "favicon-32.png", 32, 32)
    (web / "isotipo.svg").write_text(ISOTIPO, encoding="utf-8")
    (web / "simbolo.svg").write_text(SIMBOLO_CLARO, encoding="utf-8")
    (web / "simbolo-oscuro.svg").write_text(SIMBOLO_OSCURO, encoding="utf-8")
    for nombre, ancho, alto, salida in [
        ("social.html", 1200, 630, "social.png"),
    ]:
        if (AQUI / nombre).exists():
            pagina(nombre, ancho, alto, web / salida)

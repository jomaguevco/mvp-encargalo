"""
Genera todas las imágenes de marca a partir de los SVG de esta carpeta.

    python marca/generar.py

Rasteriza con Chrome sin ventana (ya está instalado y dibuja SVG y fuentes web
igual que el navegador), así no hace falta instalar nada. Si cambias el
isotipo, cambia isotipo.svg y vuelve a correr esto: los íconos de la app, el
splash, el favicon y las imágenes de la web salen de aquí.
"""
import re
import subprocess
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

ISOTIPO = (AQUI / "isotipo.svg").read_text(encoding="utf-8")
# El dibujo sin el cuadrado de fondo: para el ícono adaptable y el splash.
SOLO_DIBUJO = re.sub(r'<rect width="512" height="512"[^>]*/>', "", ISOTIPO)
# Silueta en un solo color: Android la usa en los íconos temáticos y solo mira
# la transparencia, así que el aro y el check del sello se recortan con una
# máscara (pintados en negro dentro de ella) en vez de pintarse.
def _monocromo(svg: str) -> str:
    cuerpo = svg[svg.index(">") + 1: svg.rindex("</svg>")]
    cuerpo = re.sub(r"<defs>.*?</defs>", "", cuerpo, flags=re.S)
    sello = re.search(r'<circle .*?/>\s*<path d="M338.*?/>', cuerpo, re.S).group(0)
    recorte = (sello.replace('fill="#EE6C34"', 'fill="none"')
                    .replace('stroke="#0E3255"', 'stroke="#000"')
                    .replace('stroke="#FFFFFF"', 'stroke="#000"'))
    blanco = re.sub(r'fill="#[0-9A-Fa-f]{6}"', 'fill="#FFF"', cuerpo)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
            '<mask id="m"><rect width="512" height="512" fill="#FFF"/>'
            + recorte + '</mask><g mask="url(#m)">' + blanco + "</g></svg>")


MONOCROMO = _monocromo(SOLO_DIBUJO)


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
    html = html.replace("{{ISOTIPO}}", ISOTIPO.replace(
        "<svg ", '<svg width="100%" height="100%" ', 1))
    png(html, destino, ancho, alto, transparente=False)


if __name__ == "__main__":
    img = RAIZ / "assets" / "images"
    web = RAIZ / "web" / "img"
    print("App:")
    png(lienzo(ISOTIPO, 1024), img / "icon.png", 1024, 1024)
    # Android recorta el ícono adaptable a un círculo del 66 % central.
    png(lienzo(SOLO_DIBUJO, 1024, 0.62), img / "android-icon-foreground.png", 1024, 1024)
    png(lienzo("", 1024, fondo="linear-gradient(135deg,#1A5288,#0E3255)"),
        img / "android-icon-background.png", 1024, 1024)
    png(lienzo(MONOCROMO, 1024, 0.62), img / "android-icon-monochrome.png", 1024, 1024)
    png(lienzo(SOLO_DIBUJO, 512), img / "splash-icon.png", 512, 512)
    png(lienzo(ISOTIPO, 48), img / "favicon.png", 48, 48)

    print("Web:")
    png(lienzo(ISOTIPO, 180), web / "apple-touch-icon.png", 180, 180)
    png(lienzo(ISOTIPO, 32), web / "favicon-32.png", 32, 32)
    (web / "isotipo.svg").write_text(ISOTIPO, encoding="utf-8")
    for nombre, ancho, alto, salida in [
        ("social.html", 1200, 630, "social.png"),
    ]:
        if (AQUI / nombre).exists():
            pagina(nombre, ancho, alto, web / salida)

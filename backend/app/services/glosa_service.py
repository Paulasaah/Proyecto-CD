from typing import Dict, List


class GlosaService:
    def __init__(self) -> None:
        # Diccionario simple glosa → palabra/frase en español.
        # Las claves se manejan en MAYÚSCULAS y con '_' como separador.
        self._dictionary: Dict[str, str] = {
            "HOLA": "hola",
            "YO": "yo",
            "TU": "tú",
            "USTED": "usted",
            "USTEDES": "ustedes",
            "NOSOTROS": "nosotros",
            "NOSOTRAS": "nosotras",
            "EL": "él",
            "ELLA": "ella",
            "ELLOS": "ellos",
            "ELLAS": "ellas",
            "GRACIAS": "gracias",
            "POR_FAVOR": "por favor",
            "AYUDA": "ayuda",
            "AYUDAR": "ayudo",
            "APRENDER": "aprendo",
            "ESTUDIAR": "estudio",
            "TRABAJAR": "trabajo",
            "ESCUELA": "escuela",
            "UNIVERSIDAD": "universidad",
            "CASA": "casa",
            "LSC": "lengua de señas colombiana",
            "COLOMBIA": "Colombia",
            "AYER": "ayer",
            "HOY": "hoy",
            "MANANA": "mañana",
            "PREGUNTA": "pregunta",
            "PREGUNTAR": "pregunto",
            "NO": "no",
            "SI": "sí",
            # Etiquetas específicas del modelo
            "BALON": "balón",
            "BUENAS_NOCHES": "buenas noches",
            "BUENOS_DIAS": "buenos días",
            "YA": "ya",
            "ROJO": "rojo",
            "HIJO": "hijo",
            "NACER": "nacer",
        }

    def _normalize_key(self, glosa: str) -> str:
        """Normaliza una glosa a una clave de diccionario estable."""
        return (
            glosa.strip()
            .upper()
            .replace("-", "_")
            .replace(" ", "_")
        )

    def _translate_token(self, key: str) -> str:
        """Traduce una sola glosa usando el diccionario o una heurística básica."""
        mapped = self._dictionary.get(key)
        if mapped:
            return mapped
        # Fallback: usar la glosa "limpia" en minúsculas.
        return key.replace("_", " ").lower()

    def translate(self, glosas: List[str]) -> str:
        keys: List[str] = []
        for glosa in glosas:
            if not glosa:
                continue
            keys.append(self._normalize_key(glosa))

        if not keys:
            return ""

        words: List[str] = [self._translate_token(key) for key in keys]

        sentence = " ".join(words)
        sentence = sentence[0].upper() + sentence[1:]
        if not sentence.endswith((".", "?", "!")):
            sentence = sentence + "."
        return sentence

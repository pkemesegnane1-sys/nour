#!/usr/bin/env python3
"""Télécharge le Coran complet (arabe uthmani, phonétique, français Hamidullah)
depuis api.alquran.cloud et génère les fichiers JSON du site.

Usage : python3 scripts/fetch_quran.py
"""
import json, time, urllib.request, os, sys

OUT = os.path.join(os.path.dirname(__file__), "..", "site", "data")
os.makedirs(OUT, exist_ok=True)

FRENCH_NAMES = {
    1: ("Al-Fatiha", "L'Ouverture"), 2: ("Al-Baqarah", "La Vache"),
    3: ("Ali 'Imran", "La Famille d'Imran"), 4: ("An-Nisa", "Les Femmes"),
    5: ("Al-Ma'idah", "La Table Servie"), 6: ("Al-An'am", "Les Bestiaux"),
    7: ("Al-A'raf", "Les Rangs"), 8: ("Al-Anfal", "Le Butin"),
    9: ("At-Tawbah", "Le Repentir"), 10: ("Yunus", "Jonas"),
    11: ("Hud", "Hud"), 12: ("Yusuf", "Joseph"),
    13: ("Ar-Ra'd", "Le Tonnerre"), 14: ("Ibrahim", "Abraham"),
    15: ("Al-Hijr", "Al-Hijr"), 16: ("An-Nahl", "Les Abeilles"),
    17: ("Al-Isra", "Le Voyage Nocturne"), 18: ("Al-Kahf", "La Caverne"),
    19: ("Maryam", "Marie"), 20: ("Ta-Ha", "Ta-Ha"),
    21: ("Al-Anbiya", "Les Prophètes"), 22: ("Al-Hajj", "Le Pèlerinage"),
    23: ("Al-Mu'minun", "Les Croyants"), 24: ("An-Nur", "La Lumière"),
    25: ("Al-Furqan", "Le Discernement"), 26: ("Ash-Shu'ara", "Les Poètes"),
    27: ("An-Naml", "Les Fourmis"), 28: ("Al-Qasas", "Le Récit"),
    29: ("Al-'Ankabut", "L'Araignée"), 30: ("Ar-Rûm", "Les Romains"),
    31: ("Luqman", "Luqman"), 32: ("As-Sajdah", "La Prosternation"),
    33: ("Al-Ahzab", "Les Coalisés"), 34: ("Saba", "Saba"),
    35: ("Fatir", "Le Créateur"), 36: ("Ya-Sin", "Ya-Sin"),
    37: ("As-Saffat", "Les Rangés"), 38: ("Sad", "Sad"),
    39: ("Az-Zumar", "Les Groupes"), 40: ("Ghafir", "Le Pardonneur"),
    41: ("Fussilat", "Les Versets Détaillés"), 42: ("Ash-Shura", "La Consultation"),
    43: ("Az-Zukhruf", "L'Ornement"), 44: ("Ad-Dukhan", "La Fumée"),
    45: ("Al-Jathiyah", "L'Agenouillée"), 46: ("Al-Ahqaf", "Al-Ahqaf"),
    47: ("Muhammad", "Muhammad"), 48: ("Al-Fath", "La Victoire Éclatante"),
    49: ("Al-Hujurat", "Les Appartements"), 50: ("Qaf", "Qaf"),
    51: ("Adh-Dhariyat", "Qui Éparpillent"), 52: ("At-Tur", "Le Mont"),
    53: ("An-Najm", "L'Étoile"), 54: ("Al-Qamar", "La Lune"),
    55: ("Ar-Rahman", "Le Tout Miséricordieux"), 56: ("Al-Waqi'ah", "L'Événement"),
    57: ("Al-Hadid", "Le Fer"), 58: ("Al-Mujadilah", "La Discussion"),
    59: ("Al-Hashr", "L'Exode"), 60: ("Al-Mumtahanah", "L'Éprouvée"),
    61: ("As-Saff", "Le Rang"), 62: ("Al-Jumu'ah", "Le Vendredi"),
    63: ("Al-Munafiqun", "Les Hypocrites"), 64: ("At-Taghabun", "La Grande Perte"),
    65: ("At-Talaq", "Le Divorce"), 66: ("At-Tahrim", "L'Interdiction"),
    67: ("Al-Mulk", "La Royauté"), 68: ("Al-Qalam", "La Plume"),
    69: ("Al-Haqqah", "Celle qui Montre la Vérité"), 70: ("Al-Ma'arij", "Les Voies d'Ascension"),
    71: ("Nuh", "Noé"), 72: ("Al-Jinn", "Les Djinns"),
    73: ("Al-Muzzammil", "L'Enveloppé"), 74: ("Al-Muddaththir", "Le Revêtu d'un Manteau"),
    75: ("Al-Qiyamah", "La Résurrection"), 76: ("Al-Insan", "L'Homme"),
    77: ("Al-Mursalat", "Les Envoyés"), 78: ("An-Naba", "La Nouvelle"),
    79: ("An-Nazi'at", "Les Anges qui Arrachent"), 80: ("'Abasa", "Il s'est Renfrogné"),
    81: ("At-Takwir", "L'Obscurcissement"), 82: ("Al-Infitar", "La Rupture"),
    83: ("Al-Mutaffifin", "Les Fraudeurs"), 84: ("Al-Inshiqaq", "La Déchirure"),
    85: ("Al-Buruj", "Les Constellations"), 86: ("At-Tariq", "L'Astre Nocturne"),
    87: ("Al-A'la", "Le Très-Haut"), 88: ("Al-Ghashiyah", "L'Enveloppante"),
    89: ("Al-Fajr", "L'Aube"), 90: ("Al-Balad", "La Cité"),
    91: ("Ash-Shams", "Le Soleil"), 92: ("Al-Layl", "La Nuit"),
    93: ("Ad-Duha", "Le Jour Montant"), 94: ("Ash-Sharh", "L'Ouverture"),
    95: ("At-Tin", "Le Figuier"), 96: ("Al-'Alaq", "L'Adhérence"),
    97: ("Al-Qadr", "La Destinée"), 98: ("Al-Bayyinah", "La Preuve"),
    99: ("Az-Zalzalah", "La Secousse"), 100: ("Al-'Adiyat", "Les Coursiers"),
    101: ("Al-Qari'ah", "Le Fracas"), 102: ("At-Takathur", "La Course aux Richesses"),
    103: ("Al-'Asr", "Le Temps"), 104: ("Al-Humazah", "Les Calomniateurs"),
    105: ("Al-Fil", "L'Éléphant"), 106: ("Quraysh", "Quraysh"),
    107: ("Al-Ma'un", "L'Ustensile"), 108: ("Al-Kawthar", "L'Abondance"),
    109: ("Al-Kafirun", "Les Infidèles"), 110: ("An-Nasr", "Le Secours"),
    111: ("Al-Masad", "Les Fibres"), 112: ("Al-Ikhlas", "Le Monothéisme Pur"),
    113: ("Al-Falaq", "L'Aube Naissante"), 114: ("An-Nas", "Les Hommes"),
}

# Basmala : 4 mots à retirer du 1er verset des sourates 2-114
def strip_basmala(text):
    words = text.split()
    if len(words) >= 5 and words[0].replace("\ufeff", "").startswith("بِسْمِ"):
        return " ".join(words[4:])
    return text

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NourApp/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print(f"  retry {i+1} for {url}: {e}", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError(f"failed {url}")

def main():
    print("Téléchargement des 3 éditions complètes…")
    ar = get("https://api.alquran.cloud/v1/quran/quran-uthmani")["data"]["surahs"]
    fr = get("https://api.alquran.cloud/v1/quran/fr.hamidullah")["data"]["surahs"]
    ph = get("https://api.alquran.cloud/v1/quran/en.transliteration")["data"]["surahs"]
    print(f"OK : {len(ar)} sourates")

    # Assemble les sourates puis les regroupe en paquets de ~400 Ko
    # (limite GitHub : 100 fichiers par téléversement → on minimise les fichiers)
    import math
    all_surahs = []
    for i in range(114):
        n = i + 1
        sar, sfr, sph = ar[i], fr[i], ph[i]
        name_fr, meaning_fr = FRENCH_NAMES[n]
        ayahs = []
        for j in range(len(sar["ayahs"])):
            a_ar = sar["ayahs"][j]["text"].replace("\ufeff", "").strip()
            if j == 0 and n != 1:
                a_ar = strip_basmala(a_ar)
            ayahs.append({
                "number": j + 1,
                "ar": a_ar,
                "phonetic": sph["ayahs"][j]["text"].replace("\ufeff", "").strip(),
                "fr": sfr["ayahs"][j]["text"].replace("\ufeff", "").strip(),
            })
        rev = "Mecquoise" if sar["revelationType"] == "Meccan" else "Médinoise"
        all_surahs.append({
            "number": n,
            "name": sar["name"],
            "latin": name_fr,
            "meaning": meaning_fr,
            "revelationType": rev,
            "numberOfAyahs": len(ayahs),
            "ayahs": ayahs,
        })

    chunk_dir = os.path.join(OUT, "chunks")
    os.makedirs(chunk_dir, exist_ok=True)
    TARGET = 400_000
    chunks, current, size = [], {}, 0
    for s in all_surahs:
        raw = json.dumps(s, ensure_ascii=False, separators=(",", ":"))
        if current and size + len(raw) > TARGET:
            chunks.append(current)
            current, size = {}, 0
        current[str(s["number"])] = s
        size += len(raw)
    if current:
        chunks.append(current)

    surahs_index = []
    for i, ch in enumerate(chunks, 1):
        with open(os.path.join(chunk_dir, f"c{i}.json"), "w", encoding="utf-8") as f:
            json.dump(ch, f, ensure_ascii=False, separators=(",", ":"))
        for k in ch:
            s = all_surahs[int(k) - 1]
            surahs_index.append({key: s[key] for key in
                                 ("number", "name", "latin", "meaning", "revelationType", "numberOfAyahs")})
            surahs_index[-1]["chunk"] = i

    with open(os.path.join(OUT, "surahs.json"), "w", encoding="utf-8") as f:
        json.dump(surahs_index, f, ensure_ascii=False, separators=(",", ":"))
    total = sum(s["numberOfAyahs"] for s in surahs_index)
    print(f"Terminé : 114 sourates, {total} versets, {len(chunks)} paquets.")

if __name__ == "__main__":
    main()

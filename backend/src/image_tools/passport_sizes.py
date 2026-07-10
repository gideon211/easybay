from dataclasses import dataclass
from typing import Optional


@dataclass
class PassportSpec:
    country: str
    code: str
    region: str
    width_mm: int
    height_mm: int
    width_px: int
    height_px: int
    dpi: int
    bg_color: str
    bg_color_name: str
    emoji: str
    notes: Optional[str] = None


COUNTRY_SPECS: list[PassportSpec] = [
    PassportSpec("United States", "US", "North America", 51, 51, 600, 600, 300, "#ffffff", "White", "🇺🇸"),
    PassportSpec("Canada", "CA", "North America", 50, 70, 590, 827, 300, "#ffffff", "White", "🇨🇦"),
    PassportSpec("Mexico", "MX", "North America", 35, 45, 413, 531, 300, "#ffffff", "White", "🇲🇽"),
    PassportSpec("United Kingdom", "GB", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇬🇧"),
    PassportSpec("Germany", "DE", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇩🇪"),
    PassportSpec("France", "FR", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇫🇷"),
    PassportSpec("Italy", "IT", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇮🇹"),
    PassportSpec("Spain", "ES", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇪🇸"),
    PassportSpec("Netherlands", "NL", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇳🇱"),
    PassportSpec("Sweden", "SE", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇸🇪"),
    PassportSpec("Switzerland", "CH", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇨🇭"),
    PassportSpec("Russia", "RU", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇷🇺"),
    PassportSpec("India", "IN", "Asia", 51, 51, 600, 600, 300, "#ffffff", "White", "🇮🇳"),
    PassportSpec("China", "CN", "Asia", 33, 48, 390, 567, 300, "#ffffff", "White", "🇨🇳"),
    PassportSpec("Japan", "JP", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇯🇵"),
    PassportSpec("South Korea", "KR", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇰🇷"),
    PassportSpec("Philippines", "PH", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇵🇭"),
    PassportSpec("Vietnam", "VN", "Asia", 40, 60, 472, 709, 300, "#ffffff", "White", "🇻🇳"),
    PassportSpec("Indonesia", "ID", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇮🇩"),
    PassportSpec("Thailand", "TH", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇹🇭"),
    PassportSpec("Singapore", "SG", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇸🇬"),
    PassportSpec("Malaysia", "MY", "Asia", 35, 50, 413, 591, 300, "#ffffff", "White", "🇲🇾"),
    PassportSpec("Nigeria", "NG", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇳🇬"),
    PassportSpec("Ghana", "GH", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇬🇭"),
    PassportSpec("Kenya", "KE", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇰🇪"),
    PassportSpec("South Africa", "ZA", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇿🇦"),
    PassportSpec("Ethiopia", "ET", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇪🇹"),
    PassportSpec("Egypt", "EG", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇪🇬"),
    PassportSpec("Morocco", "MA", "Africa", 35, 45, 413, 531, 300, "#ffffff", "White", "🇲🇦"),
    PassportSpec("Australia", "AU", "Oceania", 35, 45, 413, 531, 300, "#ffffff", "White", "🇦🇺"),
    PassportSpec("New Zealand", "NZ", "Oceania", 35, 45, 413, 531, 300, "#ffffff", "White", "🇳🇿"),
    PassportSpec("Brazil", "BR", "South America", 30, 40, 354, 472, 300, "#ffffff", "White", "🇧🇷"),
    PassportSpec("Argentina", "AR", "South America", 35, 45, 413, 531, 300, "#ffffff", "White", "🇦🇷"),
    PassportSpec("Chile", "CL", "South America", 35, 45, 413, 531, 300, "#ffffff", "White", "🇨🇱"),
    PassportSpec("Colombia", "CO", "South America", 35, 45, 413, 531, 300, "#ffffff", "White", "🇨🇴"),
    PassportSpec("Saudi Arabia", "SA", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇸🇦"),
    PassportSpec("United Arab Emirates", "AE", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇦🇪"),
    PassportSpec("Turkey", "TR", "Europe", 35, 45, 413, 531, 300, "#ffffff", "White", "🇹🇷"),
    PassportSpec("Pakistan", "PK", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇵🇰"),
    PassportSpec("Bangladesh", "BD", "Asia", 35, 45, 413, 531, 300, "#ffffff", "White", "🇧🇩"),
]

SPECS_BY_CODE: dict[str, PassportSpec] = {s.code: s for s in COUNTRY_SPECS}

from __future__ import annotations

import io
import asyncio
import html as html_lib
import logging
import os
import re
import secrets
import unicodedata
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

import bcrypt
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Cookie, Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from openpyxl import load_workbook
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR.parent / ".env")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "plataforma_formativa_ritsi")
SHEET_ID = os.getenv("FORMATIONS_SHEET_ID", "1JSRrepNNdQDl6zeroZPDKUJztLhSC3j6r7y2h_ND09c")
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "7"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


class UserType(str, Enum):
    REPRESENTANTE = "representante"
    UNIVERSIDAD = "universidad"
    JUNTA_DIRECTIVA = "junta_directiva"
    FORMADOR = "formador"
    COLABORACION_EXTERNA = "colaboracion_externa"
    ADMIN = "admin"


class BoardPosition(str, Enum):
    PRESIDENCIA = "presidencia"
    VICEPRESIDENCIA_POLITICA_UNIVERSITARIA = "vicepresidencia_politica_universitaria"
    TESORERIA = "tesoreria"
    SECRETARIA = "secretaria"
    VICEPRESIDENCIA_COMUNICACION = "vicepresidencia_comunicacion"
    MIEMBRO_ADICIONAL_1 = "miembro_adicional_1"
    MIEMBRO_ADICIONAL_2 = "miembro_adicional_2"


REQUIRED_BOARD_POSITIONS = {
    BoardPosition.PRESIDENCIA,
    BoardPosition.VICEPRESIDENCIA_POLITICA_UNIVERSITARIA,
    BoardPosition.TESORERIA,
    BoardPosition.SECRETARIA,
    BoardPosition.VICEPRESIDENCIA_COMUNICACION,
}


class ContentStatus(str, Enum):
    PENDING = "pending"
    PUBLISHED = "published"


class FileType(str, Enum):
    VIDEO = "video"
    PDF = "pdf"
    IMAGE = "image"
    PRESENTATION = "presentation"
    DOCUMENT = "document"
    LINK = "link"


class QuestionType(str, Enum):
    TRUE_FALSE = "true_false"
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_RESPONSE = "multiple_response"


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    picture: Optional[str] = None
    user_type: UserType = UserType.REPRESENTANTE
    board_position: Optional[BoardPosition] = None
    vocalia_ids: List[str] = Field(default_factory=list)
    is_active: bool = True
    university_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class University(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    is_active: bool = True
    zone: Optional[str] = None
    acronym: Optional[str] = None
    region: Optional[str] = None
    website_url: Optional[str] = None
    center_name: Optional[str] = None
    center_url: Optional[str] = None
    is_ritsi_member: Optional[bool] = None
    source_key: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Vocalia(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    board_member_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContentFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_type: FileType = FileType.LINK
    url: str
    title: str
    description: Optional[str] = None


class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_text: str
    question_type: QuestionType
    options: List[str] = Field(default_factory=list)
    correct_answers: List[int] = Field(default_factory=list)


class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    questions: List[Question] = Field(default_factory=list)
    passing_percentage: float = 70.0


class TrainingContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    external_id: Optional[str] = None
    source_code: Optional[str] = None
    source_sheet: Optional[str] = None
    academic_year: Optional[str] = None
    title: str
    description: Optional[str] = None
    training_date: Optional[str] = None
    audience: Optional[str] = None
    duration_minutes: Optional[int] = None
    attendees: Optional[int] = None
    rating: Optional[float] = None
    trainer_names: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    status: ContentStatus = ContentStatus.PENDING
    is_public: bool = False
    files: List[ContentFile] = Field(default_factory=list)
    category_ids: List[str] = Field(default_factory=list)
    quizzes: List[Quiz] = Field(default_factory=list)
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContentAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_id: str
    assigned_to_user_ids: List[str] = Field(default_factory=list)
    assigned_to_all_representatives: bool = False
    assigned_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor_id: str
    actor_name: str
    action: str
    target_user_id: str
    target_user_name: str
    details: Optional[Dict[str, Any]] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(LoginRequest):
    name: str = Field(min_length=2, max_length=120)
    university_id: str


class UserCreate(LoginRequest):
    name: str = Field(min_length=2, max_length=120)
    user_type: UserType = UserType.REPRESENTANTE
    university_id: Optional[str] = None


class UpdateUserRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    user_type: Optional[UserType] = None
    university_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class BoardMemberInput(BaseModel):
    user_id: str
    position: BoardPosition


class BoardUpdateRequest(BaseModel):
    members: List[BoardMemberInput]


class VocaliaCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=600)
    board_member_id: str


class AssignUsersRequest(BaseModel):
    user_ids: List[str]


class UniversityCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    zone: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    is_active: bool


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class ContentFileCreate(BaseModel):
    file_type: FileType = FileType.LINK
    url: str
    title: str
    description: Optional[str] = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("La URL debe comenzar por http:// o https://")
        return value


class TrainingContentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=240)
    description: Optional[str] = None
    is_public: bool = False
    category_ids: List[str] = Field(default_factory=list)
    files: List[ContentFileCreate] = Field(default_factory=list)
    quizzes: List[Quiz] = Field(default_factory=list)
    training_date: Optional[str] = None
    audience: Optional[str] = None
    duration_minutes: Optional[int] = None
    trainer_names: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class AssignContentRequest(BaseModel):
    content_id: str
    user_ids: List[str] = Field(default_factory=list)
    assign_to_all_representatives: bool = False


class ImportFormationsRequest(BaseModel):
    spreadsheet_id: str = SHEET_ID
    publish: bool = True


class MarkFileCompletedRequest(BaseModel):
    content_id: str
    file_id: str


class SubmitQuizRequest(BaseModel):
    content_id: str
    quiz_id: str
    answers: Dict[str, List[int]]


def serialize(model: BaseModel) -> Dict[str, Any]:
    return model.model_dump(mode="json")


def password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def password_matches(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, AttributeError):
        return False


def normalize(value: Any) -> str:
    text = "" if value is None else str(value).strip().lower()
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def modernize_text(value: Any) -> str:
    text = str(value or "").strip()
    replacements = (
        (r"(?i)coordinaciones\s+tem[aá]ticas", "Vocalías"),
        (r"(?i)coordinaci[oó]n\s+tem[aá]tica", "Vocalía"),
        (r"(?i)comisiones\s+tem[aá]ticas", "Vocalías"),
        (r"(?i)comisi[oó]n\s+tem[aá]tica", "Vocalía"),
        (r"(?i)coordinador(?:a)?\s+de\s+la\s+escuela\s+de\s+formaci[oó]n", "Vocalía de Formación"),
        (r"(?i)coordinaci[oó]n\s+de\s+la\s+escuela\s+de\s+formaci[oó]n", "Vocalía de Formación"),
        (r"(?i)escuela\s+de\s+formaci[oó]n", "Vocalía de Formación"),
    )
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)
    return "Vocalías" if normalize(text) == "ct" else text


RITSI_REGIONS = {
    1: ("Andalucía", "I"), 2: ("Aragón", "IV"), 3: ("Asturias", "III"),
    4: ("Islas Baleares", "V"), 5: ("País Vasco", "III"), 6: ("Islas Canarias", "IV"),
    7: ("Cantabria", "III"), 8: ("Castilla y León", "IV"), 9: ("Castilla-La Mancha", "I"),
    10: ("Cataluña", "V"), 11: ("Extremadura", "IV"), 12: ("Galicia", "III"),
    13: ("La Rioja", "III"), 14: ("Madrid", "II"), 15: ("Murcia", "I"),
    16: ("Navarra", "III"), 17: ("Valencia", "V"),
}


def clean_html(value: str) -> str:
    return re.sub(r"\s+", " ", html_lib.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def parse_ritsi_universities(region_id: int, markup: str) -> List[Dict[str, Any]]:
    region, zone = RITSI_REGIONS[region_id]
    cards = re.findall(
        r'<div class="mdc-card (no-member|member)">(.*?)(?=<div class="item">|\Z)',
        markup,
        flags=re.IGNORECASE | re.DOTALL,
    )
    universities = []
    for membership, card in cards:
        name_match = re.search(r'class="university-name">.*?<b>(.*?)</b>', card, flags=re.IGNORECASE | re.DOTALL)
        if not name_match:
            continue
        name = clean_html(name_match.group(1))
        acronym_match = re.search(r"\(([A-ZÀ-Ü0-9-]{2,12})\)\s*$", name)
        website_match = re.search(r'class="mdc-card__media[^>]*href="([^"]+)"', card, flags=re.IGNORECASE | re.DOTALL)
        center_match = re.search(r'class="center-name">.*?<a href="([^"]+)"[^>]*>.*?<u>(.*?)</u>', card, flags=re.IGNORECASE | re.DOTALL)
        universities.append({
            "name": name,
            "acronym": acronym_match.group(1) if acronym_match else None,
            "region": region,
            "zone": zone,
            "website_url": html_lib.unescape(website_match.group(1)) if website_match else None,
            "center_url": html_lib.unescape(center_match.group(1)) if center_match else None,
            "center_name": clean_html(center_match.group(2)) if center_match else None,
            "is_ritsi_member": membership.lower() == "member",
            "is_active": membership.lower() == "member",
            "source_key": f"ritsi:{normalize(name)}",
        })
    return universities


async def import_ritsi_universities() -> Dict[str, int]:
    async def fetch_region(region_id: int):
        url = f"https://ritsi.org/index.php?freemap_get_state_info={region_id}&map_id=0"
        response = await asyncio.to_thread(requests.post, url, timeout=30)
        response.raise_for_status()
        # The endpoint serves UTF-8 HTML without declaring its charset, so
        # requests otherwise falls back to ISO-8859-1 and corrupts accents.
        return parse_ritsi_universities(region_id, response.content.decode("utf-8"))

    region_results = await asyncio.gather(*(fetch_region(region_id) for region_id in RITSI_REGIONS))
    unique: Dict[str, Dict[str, Any]] = {}
    for item in (university for region in region_results for university in region):
        key = item["source_key"]
        if key not in unique or item["is_ritsi_member"]:
            unique[key] = item
    created = updated = 0
    for item in unique.values():
        matches = [
            {"source_key": item["source_key"]},
            {"name": {"$regex": f"^{re.escape(item['name'])}$", "$options": "i"}},
        ]
        # The URL also lets a re-import repair records created before the
        # source encoding was handled explicitly.
        if item.get("website_url"):
            matches.append({"website_url": item["website_url"]})
        existing = await db.universities.find_one({"$or": matches})
        if existing:
            await db.universities.update_one({"_id": existing["_id"]}, {"$set": item})
            updated += 1
        else:
            university = University(**item)
            await db.universities.insert_one(serialize(university))
            created += 1
    return {"found": len(unique), "created": created, "updated": updated}


def validate_board_members(members: List[BoardMemberInput]) -> None:
    if not 5 <= len(members) <= 7:
        raise ValueError("La Junta Directiva debe tener entre 5 y 7 miembros")
    user_ids = [member.user_id for member in members]
    positions = [member.position for member in members]
    if len(set(user_ids)) != len(user_ids):
        raise ValueError("Una persona no puede ocupar dos cargos de Junta Directiva")
    if len(set(positions)) != len(positions):
        raise ValueError("Cada cargo de Junta Directiva solo puede asignarse una vez")
    missing = REQUIRED_BOARD_POSITIONS - set(positions)
    if missing:
        raise ValueError("Faltan cargos obligatorios: " + ", ".join(sorted(item.value for item in missing)))


def infer_file_type(title: str, url: str) -> FileType:
    value = normalize(f"{title} {url}")
    if "grabacion" in value or "youtube" in value or "youtu.be" in value or "video" in value:
        return FileType.VIDEO
    if ".pdf" in value or "informe" in value:
        return FileType.PDF
    if "presentation" in value or "presentacion" in value or "canva" in value:
        return FileType.PRESENTATION
    if any(ext in value for ext in (".png", ".jpg", ".jpeg", ".webp")):
        return FileType.IMAGE
    if "document" in value or "documento" in value:
        return FileType.DOCUMENT
    return FileType.LINK


def cell_url(cell: Any) -> Optional[str]:
    if cell.hyperlink:
        return cell.hyperlink.target
    match = re.search(r'HYPERLINK\("([^"]+)', str(cell.value or ""), flags=re.IGNORECASE)
    return match.group(1) if match else None


def clean_int(value: Any) -> Optional[int]:
    try:
        return int(float(str(value).replace(",", ".")))
    except (TypeError, ValueError):
        return None


def clean_float(value: Any) -> Optional[float]:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def clean_date(value: Any) -> Optional[str]:
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    text = str(value or "").strip()
    if not text or text == "-":
        return None
    for pattern in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            pass
    return text


def parse_sheet_workbook(binary: bytes, created_by: str, publish: bool) -> List[TrainingContent]:
    workbook = load_workbook(io.BytesIO(binary), data_only=False, read_only=False)
    results: List[TrainingContent] = []
    for worksheet in workbook.worksheets:
        if normalize(worksheet.title) in {"hoja 5", "siglas"}:
            continue
        header_row, headers = None, []
        for row_index in range(1, min(worksheet.max_row, 8) + 1):
            values = [normalize(worksheet.cell(row_index, column).value) for column in range(1, worksheet.max_column + 1)]
            if any("codigo" in value and "formacion" in value for value in values):
                header_row, headers = row_index, values
                break
        if not header_row:
            continue

        def index_of(predicate, default=None):
            return next((index for index, value in enumerate(headers) if predicate(value)), default)

        code_i = index_of(lambda value: "codigo" in value)
        date_i = index_of(lambda value: value == "fecha")
        audience_i = index_of(lambda value: "dirigido" in value)
        attendees_i = index_of(lambda value: "asistentes" in value)
        duration_i = index_of(lambda value: "duracion" in value)
        rating_i = index_of(lambda value: "valoracion" in value)
        files_i = index_of(lambda value: "archivos adjuntos" in value)
        tags_i = index_of(lambda value: "etiquetas" in value)
        name_indices = [i for i, value in enumerate(headers) if value == "nombre"]
        title_i = next((i for i in name_indices if duration_i is not None and i > duration_i), name_indices[0] if name_indices else None)
        trainer_indices = [i for i in name_indices if title_i is not None and i > title_i and (files_i is None or i < files_i)]
        if code_i is None or title_i is None:
            continue
        empty_streak = 0
        for row_index in range(header_row + 1, worksheet.max_row + 1):
            cells = list(worksheet[row_index])
            code = str(cells[code_i].value or "").strip()
            title = modernize_text(cells[title_i].value)
            if not code and not title:
                empty_streak += 1
                if empty_streak >= 20:
                    break
                continue
            empty_streak = 0
            if normalize(code) in {"total", "totales"} or normalize(title) in {"total", "totales"}:
                continue
            files: List[ContentFile] = []
            if files_i is not None:
                end_i = tags_i if tags_i is not None else min(len(cells), files_i + 6)
                for cell in cells[files_i:end_i]:
                    url = cell_url(cell)
                    if url:
                        file_title = str(cell.value or "Recurso").strip()
                        files.append(ContentFile(file_type=infer_file_type(file_title, url), url=url, title=file_title))
            trainers = []
            for index in trainer_indices:
                value = str(cells[index].value or "").strip()
                if value and value not in trainers:
                    trainers.append(value)
            raw_tags = modernize_text(cells[tags_i].value) if tags_i is not None else ""
            tags = [modernize_text(item) for item in re.split(r"[,;\n]", raw_tags) if item.strip()]
            results.append(TrainingContent(
                external_id=f"{worksheet.title}:{code or title}", source_code=code or None,
                source_sheet=worksheet.title, academic_year=worksheet.title, title=title or code,
                description=raw_tags.strip() or None,
                training_date=clean_date(cells[date_i].value) if date_i is not None else None,
                audience=(modernize_text(cells[audience_i].value) or None) if audience_i is not None else None,
                duration_minutes=clean_int(cells[duration_i].value) if duration_i is not None else None,
                attendees=clean_int(cells[attendees_i].value) if attendees_i is not None else None,
                rating=clean_float(cells[rating_i].value) if rating_i is not None else None,
                trainer_names=trainers, tags=tags, files=files,
                status=ContentStatus.PUBLISHED if publish else ContentStatus.PENDING,
                is_public=True, created_by=created_by,
            ))
    return results


async def import_formations(spreadsheet_id: str, created_by: str, publish: bool = True) -> Dict[str, int]:
    response = await asyncio.to_thread(requests.get, f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=xlsx", timeout=60)
    response.raise_for_status()
    contents = await asyncio.to_thread(parse_sheet_workbook, response.content, created_by, publish)
    created = updated = 0
    for content in contents:
        payload = serialize(content)
        existing = await db.training_contents.find_one({"external_id": content.external_id}, {"id": 1})
        if existing:
            payload["id"] = existing["id"]
            await db.training_contents.update_one({"external_id": content.external_id}, {"$set": payload})
            updated += 1
        else:
            await db.training_contents.insert_one(payload)
            created += 1
    return {"found": len(contents), "created": created, "updated": updated}


async def log_activity(actor: User, action: str, target: Dict[str, Any], details: Optional[Dict[str, Any]] = None):
    entry = ActivityLog(actor_id=actor.id, actor_name=actor.name, action=action,
                        target_user_id=str(target.get("id", "system")),
                        target_user_name=str(target.get("name", target.get("title", "Sistema"))), details=details)
    await db.activity_logs.insert_one(serialize(entry))


async def get_current_user(session_token: Optional[str] = Cookie(default=None)) -> User:
    if not session_token:
        raise HTTPException(status_code=401, detail="No autorizado")
    session = await db.user_sessions.find_one({"session_token": session_token, "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="La cuenta está desactivada")
    return User(**user)


async def create_session(user: User) -> str:
    token = secrets.token_urlsafe(48)
    await db.user_sessions.insert_one({"id": str(uuid.uuid4()), "user_id": user.id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()})
    return token


def session_response(user: User, token: str, code: int = 200) -> JSONResponse:
    response = JSONResponse(serialize(user), status_code=code)
    response.set_cookie("session_token", token, httponly=True, secure=COOKIE_SECURE, samesite="lax", max_age=SESSION_DAYS * 86400, path="/")
    return response


@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.post("/auth/register")
async def register(request: RegisterRequest):
    if await db.users.find_one({"email": request.email.lower()}):
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo")
    if not await db.universities.find_one({"id": request.university_id, "is_active": True}):
        raise HTTPException(status_code=400, detail="Selecciona una universidad activa")
    user = User(email=request.email.lower(), name=request.name.strip(), university_id=request.university_id)
    payload = serialize(user)
    payload["password_hash"] = password_hash(request.password)
    await db.users.insert_one(payload)
    return session_response(user, await create_session(user), 201)


@api_router.post("/auth/login")
async def login(request: LoginRequest):
    stored = await db.users.find_one({"email": request.email.lower()})
    if not stored or not password_matches(request.password, stored.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not stored.get("is_active", True):
        raise HTTPException(status_code=403, detail="La cuenta está desactivada")
    user = User(**stored)
    return session_response(user, await create_session(user))


@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@api_router.post("/auth/logout")
async def logout(session_token: Optional[str] = Cookie(default=None)):
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response = JSONResponse({"success": True})
    response.delete_cookie("session_token", path="/")
    return response


@api_router.get("/users", response_model=List[User])
async def list_users(current_user: User = Depends(get_current_user)):
    if current_user.user_type not in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA}:
        raise HTTPException(status_code=403, detail="Sin permisos para consultar usuarios")
    return [User(**item) for item in await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(5000)]


@api_router.post("/users", response_model=User)
async def create_user(request: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos para crear usuarios")
    if request.user_type == UserType.JUNTA_DIRECTIVA:
        raise HTTPException(status_code=400, detail="Añade las personas de Junta desde su configuración")
    if await db.users.find_one({"email": request.email.lower()}):
        raise HTTPException(status_code=409, detail="El correo ya está registrado")
    if request.user_type in {UserType.REPRESENTANTE, UserType.UNIVERSIDAD}:
        if not request.university_id or not await db.universities.find_one({"id": request.university_id, "is_active": True}):
            raise HTTPException(status_code=400, detail="Este perfil requiere una universidad activa")
    user = User(email=request.email.lower(), name=request.name.strip(), user_type=request.user_type, university_id=request.university_id)
    payload = serialize(user)
    payload["password_hash"] = password_hash(request.password)
    await db.users.insert_one(payload)
    await log_activity(current_user, "Alta de usuario", payload)
    return user


@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, request: UpdateUserRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos para editar usuarios")
    stored = await db.users.find_one({"id": user_id})
    if not stored:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if request.user_type == UserType.JUNTA_DIRECTIVA:
        raise HTTPException(status_code=400, detail="Gestiona este rol desde la Junta Directiva")
    if stored.get("user_type") == UserType.JUNTA_DIRECTIVA.value and request.user_type and request.user_type != UserType.JUNTA_DIRECTIVA:
        raise HTTPException(status_code=400, detail="Actualiza la composición completa de Junta Directiva")
    if stored.get("user_type") == UserType.JUNTA_DIRECTIVA.value and request.is_active is False:
        raise HTTPException(status_code=400, detail="No se puede desactivar una persona de Junta; actualiza primero su composición")
    changes = request.model_dump(exclude_none=True, mode="json")
    raw_password = changes.pop("password", None)
    if raw_password:
        changes["password_hash"] = password_hash(raw_password)
    if changes:
        await db.users.update_one({"id": user_id}, {"$set": changes})
        await log_activity(current_user, "Actualización de usuario", stored, changes)
    return User(**await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0}))


@api_router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN or current_user.id == user_id:
        raise HTTPException(status_code=403, detail="No puedes eliminar este usuario")
    stored = await db.users.find_one({"id": user_id})
    if not stored:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if stored.get("user_type") == UserType.JUNTA_DIRECTIVA.value:
        raise HTTPException(status_code=400, detail="Actualiza primero la composición de Junta Directiva")
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_progress.delete_many({"user_id": user_id})
    await db.content_assignments.update_many({}, {"$pull": {"assigned_to_user_ids": user_id}})
    await db.users.delete_one({"id": user_id})


@api_router.get("/board", response_model=List[User])
async def get_board(current_user: User = Depends(get_current_user)):
    return [User(**item) for item in await db.users.find({"user_type": UserType.JUNTA_DIRECTIVA.value}, {"_id": 0, "password_hash": 0}).to_list(7)]


@api_router.put("/board", response_model=List[User])
async def update_board(request: BoardUpdateRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede configurar la Junta Directiva")
    try:
        validate_board_members(request.members)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    ids = [item.user_id for item in request.members]
    if await db.users.count_documents({"id": {"$in": ids}, "is_active": True, "user_type": {"$ne": UserType.ADMIN.value}}) != len(ids):
        raise HTTPException(status_code=400, detail="La Junta solo puede incluir personas activas que no sean administradoras")
    previous = await db.users.find({"user_type": UserType.JUNTA_DIRECTIVA.value}, {"id": 1}).to_list(7)
    removed_ids = [item["id"] for item in previous if item["id"] not in ids]
    if removed_ids and await db.vocalias.count_documents({"board_member_id": {"$in": removed_ids}}):
        raise HTTPException(status_code=400, detail="Reasigna las Vocalías de las personas que salen de Junta")
    if removed_ids:
        await db.users.update_many({"id": {"$in": removed_ids}}, {"$set": {"user_type": UserType.REPRESENTANTE.value, "board_position": None}})
    for member in request.members:
        await db.users.update_one({"id": member.user_id}, {"$set": {"user_type": UserType.JUNTA_DIRECTIVA.value, "board_position": member.position.value}})
    await log_activity(current_user, "Actualización de Junta Directiva", {"id": "board", "name": "Junta Directiva"})
    return await get_board(current_user)


async def validate_board_owner(user_id: str):
    if not await db.users.find_one({"id": user_id, "user_type": UserType.JUNTA_DIRECTIVA.value, "is_active": True}):
        raise HTTPException(status_code=400, detail="La Vocalía debe asociarse a una persona activa de Junta Directiva")


@api_router.get("/vocalias", response_model=List[Vocalia])
async def list_vocalias(current_user: User = Depends(get_current_user)):
    return [Vocalia(**item) for item in await db.vocalias.find({}, {"_id": 0}).to_list(1000)]


@api_router.post("/vocalias", response_model=Vocalia)
async def create_vocalia(request: VocaliaCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede crear Vocalías")
    await validate_board_owner(request.board_member_id)
    if await db.vocalias.find_one({"name": {"$regex": f"^{re.escape(request.name)}$", "$options": "i"}}):
        raise HTTPException(status_code=409, detail="Ya existe una Vocalía con ese nombre")
    vocalia = Vocalia(**request.model_dump())
    await db.vocalias.insert_one(serialize(vocalia))
    return vocalia


@api_router.put("/vocalias/{vocalia_id}", response_model=Vocalia)
async def update_vocalia(vocalia_id: str, request: VocaliaCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede editar Vocalías")
    await validate_board_owner(request.board_member_id)
    if not (await db.vocalias.update_one({"id": vocalia_id}, {"$set": request.model_dump(mode="json")})).matched_count:
        raise HTTPException(status_code=404, detail="Vocalía no encontrada")
    return Vocalia(**await db.vocalias.find_one({"id": vocalia_id}, {"_id": 0}))


@api_router.delete("/vocalias/{vocalia_id}")
async def delete_vocalia(vocalia_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede eliminar Vocalías")
    await db.users.update_many({}, {"$pull": {"vocalia_ids": vocalia_id}})
    if not (await db.vocalias.delete_one({"id": vocalia_id})).deleted_count:
        raise HTTPException(status_code=404, detail="Vocalía no encontrada")
    return {"message": "Vocalía eliminada"}


@api_router.put("/vocalias/{vocalia_id}/members")
async def update_vocalia_members(vocalia_id: str, request: AssignUsersRequest, current_user: User = Depends(get_current_user)):
    vocalia = await db.vocalias.find_one({"id": vocalia_id})
    if not vocalia:
        raise HTTPException(status_code=404, detail="Vocalía no encontrada")
    can_manage = current_user.user_type == UserType.ADMIN or (current_user.user_type == UserType.JUNTA_DIRECTIVA and vocalia["board_member_id"] == current_user.id)
    if not can_manage:
        raise HTTPException(status_code=403, detail="No puedes gestionar esta Vocalía")
    if request.user_ids and await db.users.count_documents({"id": {"$in": request.user_ids}, "is_active": True}) != len(set(request.user_ids)):
        raise HTTPException(status_code=400, detail="La selección contiene usuarios inexistentes o inactivos")
    await db.users.update_many({"vocalia_ids": vocalia_id}, {"$pull": {"vocalia_ids": vocalia_id}})
    if request.user_ids:
        await db.users.update_many({"id": {"$in": request.user_ids}}, {"$addToSet": {"vocalia_ids": vocalia_id}})
    return {"message": "Miembros actualizados", "count": len(request.user_ids)}


@api_router.get("/universities", response_model=List[University])
async def get_universities():
    return [University(**item) for item in await db.universities.find({}, {"_id": 0}).sort("name", 1).to_list(1000)]


@api_router.post("/universities/import-ritsi")
async def sync_ritsi_universities(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede sincronizar universidades")
    try:
        result = await import_ritsi_universities()
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"No se pudo consultar el listado oficial: {error}") from error
    await log_activity(current_user, "Sincronización de universidades", {"id": "ritsi-universities", "name": "Socios de RITSI"}, result)
    return result


@api_router.post("/universities", response_model=University)
async def create_university(request: UniversityCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos")
    university = University(**request.model_dump(), is_active=True, is_ritsi_member=True)
    await db.universities.insert_one(serialize(university))
    return university


@api_router.put("/universities/{university_id}", response_model=University)
async def update_university(university_id: str, request: UniversityCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos")
    if not (await db.universities.update_one({"id": university_id}, {"$set": request.model_dump()})).matched_count:
        raise HTTPException(status_code=404, detail="Universidad no encontrada")
    return University(**await db.universities.find_one({"id": university_id}, {"_id": 0}))


@api_router.put("/universities/{university_id}/status", response_model=University)
async def update_university_status(university_id: str, request: UpdateStatusRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede cambiar el estado de una universidad")
    if not (await db.universities.update_one({"id": university_id}, {"$set": {
        "is_active": request.is_active, "is_ritsi_member": request.is_active
    }})).matched_count:
        raise HTTPException(status_code=404, detail="Universidad no encontrada")
    return University(**await db.universities.find_one({"id": university_id}, {"_id": 0}))


@api_router.delete("/universities/{university_id}", status_code=204)
async def delete_university(university_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos")
    if await db.users.count_documents({"university_id": university_id}):
        raise HTTPException(status_code=400, detail="La universidad tiene usuarios asociados")
    await db.universities.delete_one({"id": university_id})


@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    return [Category(**item) for item in await db.categories.find({}, {"_id": 0}).to_list(1000)]


@api_router.post("/categories", response_model=Category)
async def create_category(request: CategoryCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA}:
        raise HTTPException(status_code=403, detail="Sin permisos")
    category = Category(name=request.name.strip())
    await db.categories.insert_one(serialize(category))
    return category


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos")
    await db.training_contents.update_many({}, {"$pull": {"category_ids": category_id}})
    await db.categories.delete_one({"id": category_id})
    return {"message": "Categoría eliminada"}


@api_router.post("/content/import-sheet")
async def import_sheet(request: ImportFormationsRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administración puede importar el catálogo")
    try:
        result = await import_formations(request.spreadsheet_id, current_user.id, request.publish)
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"No se pudo descargar la hoja: {error}") from error
    await log_activity(current_user, "Importación del catálogo", {"id": request.spreadsheet_id, "name": "Google Sheets"}, result)
    return result


@api_router.get("/content", response_model=List[TrainingContent])
async def get_content(current_user: User = Depends(get_current_user)):
    if current_user.user_type in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA}:
        query: Dict[str, Any] = {}
    elif current_user.user_type == UserType.FORMADOR:
        query = {"$or": [{"created_by": current_user.id}, {"status": ContentStatus.PUBLISHED.value}]}
    else:
        assignments = await db.content_assignments.find({"$or": [{"assigned_to_user_ids": current_user.id}, {"assigned_to_all_representatives": True}]}).to_list(5000)
        assignment_ids = [item["content_id"] for item in assignments]
        query = {"status": ContentStatus.PUBLISHED.value, "$or": [{"is_public": True}, {"id": {"$in": assignment_ids}}]}
    items = await db.training_contents.find(query, {"_id": 0}).sort([("training_date", -1), ("title", 1)]).to_list(10000)
    return [TrainingContent(**item) for item in items]


@api_router.post("/content", response_model=TrainingContent)
async def create_content(request: TrainingContentCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA, UserType.FORMADOR}:
        raise HTTPException(status_code=403, detail="Sin permisos para crear formaciones")
    content = TrainingContent(**request.model_dump(), created_by=current_user.id,
        status=ContentStatus.PUBLISHED if current_user.user_type in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA} else ContentStatus.PENDING)
    await db.training_contents.insert_one(serialize(content))
    return content


@api_router.get("/content/{content_id}", response_model=TrainingContent)
async def get_content_item(content_id: str, current_user: User = Depends(get_current_user)):
    item = await db.training_contents.find_one({"id": content_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Formación no encontrada")
    privileged = current_user.user_type in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA}
    own_draft = current_user.user_type == UserType.FORMADOR and item.get("created_by") == current_user.id
    public_item = item.get("status") == ContentStatus.PUBLISHED.value and item.get("is_public", False)
    assigned = await db.content_assignments.find_one({"content_id": content_id, "$or": [
        {"assigned_to_user_ids": current_user.id}, {"assigned_to_all_representatives": True}
    ]})
    if not (privileged or own_draft or public_item or assigned):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta formación")
    return TrainingContent(**item)


@api_router.post("/content/{content_id}/approve", response_model=TrainingContent)
async def approve_content(content_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA}:
        raise HTTPException(status_code=403, detail="Sin permisos")
    if not (await db.training_contents.update_one({"id": content_id}, {"$set": {"status": ContentStatus.PUBLISHED.value}})).matched_count:
        raise HTTPException(status_code=404, detail="Formación no encontrada")
    return TrainingContent(**await db.training_contents.find_one({"id": content_id}, {"_id": 0}))


@api_router.delete("/content/{content_id}")
async def delete_content(content_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA}:
        raise HTTPException(status_code=403, detail="Sin permisos")
    await db.training_contents.delete_one({"id": content_id})
    await db.content_assignments.delete_many({"content_id": content_id})
    await db.user_progress.delete_many({"content_id": content_id})
    return {"message": "Formación eliminada"}


@api_router.post("/assignments")
async def assign_content(request: AssignContentRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA, UserType.UNIVERSIDAD}:
        raise HTTPException(status_code=403, detail="Sin permisos")
    if current_user.user_type == UserType.UNIVERSIDAD:
        count = await db.users.count_documents({"id": {"$in": request.user_ids}, "university_id": current_user.university_id})
        if count != len(set(request.user_ids)):
            raise HTTPException(status_code=403, detail="Solo puedes asignar personas de tu universidad")
    assignment = ContentAssignment(content_id=request.content_id, assigned_to_user_ids=request.user_ids,
        assigned_to_all_representatives=request.assign_to_all_representatives, assigned_by=current_user.id)
    await db.content_assignments.insert_one(serialize(assignment))
    return assignment


@api_router.get("/progress")
async def get_progress(current_user: User = Depends(get_current_user)):
    query = {} if current_user.user_type in {UserType.ADMIN, UserType.JUNTA_DIRECTIVA} else {"user_id": current_user.id}
    return await db.user_progress.find(query, {"_id": 0}).to_list(10000)


@api_router.post("/progress/file-completed")
async def mark_file_completed(request: MarkFileCompletedRequest, current_user: User = Depends(get_current_user)):
    await db.user_progress.update_one({"user_id": current_user.id, "content_id": request.content_id},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "user_id": current_user.id, "content_id": request.content_id, "quizzes_completed": {}, "completed": False},
         "$addToSet": {"files_completed": request.file_id}, "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"message": "Progreso actualizado"}


@api_router.post("/progress/submit-quiz")
async def submit_quiz(request: SubmitQuizRequest, current_user: User = Depends(get_current_user)):
    content = await db.training_contents.find_one({"id": request.content_id})
    quiz = next((item for item in content.get("quizzes", []) if item["id"] == request.quiz_id), None) if content else None
    if not quiz:
        raise HTTPException(status_code=404, detail="Cuestionario no encontrado")
    correct = sum(1 for question in quiz["questions"] if sorted(request.answers.get(question["id"], [])) == sorted(question["correct_answers"]))
    score = (correct / len(quiz["questions"]) * 100) if quiz["questions"] else 0
    result = {"score": score, "passed": score >= quiz.get("passing_percentage", 70), "completed_at": datetime.now(timezone.utc).isoformat()}
    await db.user_progress.update_one({"user_id": current_user.id, "content_id": request.content_id},
        {"$setOnInsert": {"id": str(uuid.uuid4()), "user_id": current_user.id, "content_id": request.content_id, "files_completed": [], "completed": False},
         "$set": {f"quizzes_completed.{request.quiz_id}": result, "last_updated": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return result


@api_router.get("/activity-log", response_model=List[ActivityLog])
async def activity_log(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Sin permisos")
    return [ActivityLog(**item) for item in await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(2000)]


async def initialize_database():
    allowed_roles = [item.value for item in UserType]
    await db.users.update_many({"user_type": {"$nin": allowed_roles}}, {"$set": {"user_type": UserType.FORMADOR.value, "board_position": None}})
    await db.users.update_many({"vocalia_ids": {"$exists": False}}, {"$set": {"vocalia_ids": []}})
    legacy_contents = await db.training_contents.find({"files.google_drive_url": {"$exists": True}}).to_list(10000)
    for content in legacy_contents:
        files = []
        for item in content.get("files", []):
            resource = dict(item)
            resource["url"] = resource.pop("google_drive_url", resource.get("url", ""))
            resource["file_type"] = resource.get("file_type", FileType.LINK.value)
            files.append(resource)
        await db.training_contents.update_one({"_id": content["_id"]}, {"$set": {"files": files}})
    await db.users.create_index("email", unique=True)
    await db.training_contents.create_index("external_id", unique=True, sparse=True)
    await db.vocalias.create_index("name", unique=True)
    await db.universities.create_index("source_key", unique=True, sparse=True)
    if os.getenv("AUTO_IMPORT_UNIVERSITIES", "true").lower() == "true" and await db.universities.count_documents({}) == 0:
        try:
            await import_ritsi_universities()
        except Exception as error:
            logger.warning("No se pudo realizar la importación inicial de universidades: %s", error)
    if os.getenv("AUTO_IMPORT_FORMATIONS", "true").lower() == "true" and await db.training_contents.count_documents({}) == 0:
        try:
            await import_formations(SHEET_ID, "sheet-import", True)
        except Exception as error:
            logger.warning("No se pudo realizar la importación inicial del catálogo: %s", error)


@asynccontextmanager
async def lifespan(application: FastAPI):
    await initialize_database()
    yield
    client.close()


app = FastAPI(title="Plataforma Formativa RITSI", version="2.0.0", lifespan=lifespan)
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True,
    allow_origins=[value.strip() for value in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if value.strip()],
    allow_methods=["*"], allow_headers=["*"])

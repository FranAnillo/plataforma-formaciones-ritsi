from fastapi import FastAPI, APIRouter, HTTPException, status, Depends, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import requests
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Enums
class UserType(str, Enum):
    REPRESENTANTE = "representante"
    UNIVERSIDAD = "universidad"
    JUNTA_DIRECTIVA = "junta_directiva"
    ESCUELA_FORMACION = "escuela_formacion"
    COLABORACION_EXTERNA = "colaboracion_externa"
    ADMIN = "admin"

class QuestionType(str, Enum):
    TRUE_FALSE = "true_false"
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_RESPONSE = "multiple_response"

class FileType(str, Enum):
    VIDEO = "video"
    PDF = "pdf"
    IMAGE = "image"

# Pydantic Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    user_type: UserType
    is_active: bool = True
    university_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class University(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContentFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_type: FileType
    google_drive_url: str
    title: str
    description: Optional[str] = None

class Question(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_text: str
    question_type: QuestionType
    options: List[str] = []
    correct_answers: List[int] = []  # Índices de respuestas correctas

class Quiz(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    questions: List[Question]
    passing_percentage: float = 70.0

class TrainingContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    is_public: bool = False
    files: List[ContentFile] = []
    category_ids: List[str] = []
    quizzes: List[Quiz] = []
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content_id: str
    files_completed: List[str] = []
    quizzes_completed: Dict[str, Dict[str, Any]] = {}  # {quiz_id: {score: float, passed: bool, attempts: int}}
    completed: bool = False
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContentAssignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_id: str
    assigned_to_user_ids: List[str] = []
    assigned_to_all_representatives: bool = False
    assigned_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor_id: str
    actor_name: str
    action: str
    target_user_id: str
    target_user_name: str
    details: Optional[Dict[str, Any]] = None

# Request/Response Models
class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    university_id: str

class UniversityCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str

class ContentFileCreate(BaseModel):
    file_type: FileType
    google_drive_url: str
    title: str
    description: Optional[str] = None

class QuestionCreate(BaseModel):
    question_text: str
    question_type: QuestionType
    options: List[str]
    correct_answers: List[int]

class QuizCreate(BaseModel):
    title: str
    questions: List[QuestionCreate]
    passing_percentage: float = 70.0

class TrainingContentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = False
    category_ids: List[str] = []
    files: List[ContentFileCreate] = []
    quizzes: List[QuizCreate] = []

class AssignContentRequest(BaseModel):
    content_id: str
    user_ids: Optional[List[str]] = None
    assign_to_all_representatives: bool = False

class UnassignContentRequest(BaseModel):
    user_id: str
    content_id: str

class UpdateUserRoleRequest(BaseModel):
    user_type: UserType

class UpdateUserStatusRequest(BaseModel):
    is_active: bool

class UserImport(BaseModel):
    email: EmailStr
    name: str
    user_type: UserType
    university_id: Optional[str] = None

class UserImportRequest(BaseModel):
    users: List[UserImport]


class MarkFileCompletedRequest(BaseModel):
    content_id: str
    file_id: str

class SubmitQuizRequest(BaseModel):
    content_id: str
    quiz_id: str
    answers: Dict[str, List[int]]  # {question_id: [selected_option_indices]}

# Helper function for logging
async def log_activity(actor: User, action: str, target_user: Dict, details: Optional[Dict[str, Any]] = None):
    log_entry = ActivityLog(
        actor_id=actor.id,
        actor_name=actor.name,
        action=action,
        target_user_id=target_user["id"],
        target_user_name=target_user["name"],
        details=details
    )
    log_dict = log_entry.model_dump()
    log_dict["timestamp"] = log_dict["timestamp"].isoformat()
    await db.activity_logs.insert_one(log_dict)

# Auth dependency
async def get_current_user(session_token: Optional[str] = Cookie(None)) -> User:
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado"
        )
    
    session = await db.user_sessions.find_one({
        "session_token": session_token,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada"
        )
    
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta de usuario está desactivada"
        )
    
    return User(**user)

# Auth endpoints
@api_router.get("/auth/session")
async def get_session(session_id: str):
    """Process session_id from Emergent Auth and create user session"""
    try:
        response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sesión inválida"
            )
        
        user_data = response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
        
        if not existing_user:
            # Create new user with default type (needs registration)
            user = User(
                email=user_data["email"],
                name=user_data["name"],
                picture=user_data.get("picture"),
                user_type=UserType.REPRESENTANTE,
                university_id=None
            )
            user_dict = user.model_dump()
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            await db.users.insert_one(user_dict)
            user_id = user.id
        else:
            user_id = existing_user["id"]
        
        # Create session
        session_token = user_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session = UserSession(
            user_id=user_id,
            session_token=session_token,
            expires_at=expires_at
        )
        
        session_dict = session.model_dump()
        session_dict["expires_at"] = session_dict["expires_at"].isoformat()
        session_dict["created_at"] = session_dict["created_at"].isoformat()
        await db.user_sessions.insert_one(session_dict)
        
        response = JSONResponse(content={"success": True, "needs_registration": existing_user is None})
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7*24*60*60,
            path="/"
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando sesión: {str(e)}"
        )

@api_router.post("/auth/register")
async def register_user(request: RegisterRequest, current_user: User = Depends(get_current_user)):
    """Complete user registration with university association"""
    # Verify university exists
    university = await db.universities.find_one({"id": request.university_id}, {"_id": 0})
    if not university:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Universidad no encontrada"
        )
    
    # Update user
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "university_id": request.university_id,
            "name": request.name
        }}
    )
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    return User(**updated_user)

@api_router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver todos los usuarios"
        )
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.put("/users/{user_id}/role", response_model=User)
async def update_user_role(user_id: str, request: UpdateUserRoleRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para cambiar roles de usuario"
        )
    
    user_to_update = await db.users.find_one({"id": user_id})
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    old_role = user_to_update.get("user_type")
    new_role = request.user_type.value

    if old_role != new_role:
        await db.users.update_one({"id": user_id}, {"$set": {"user_type": new_role}})
        await log_activity(
            actor=current_user,
            action="Cambio de rol",
            target_user=user_to_update,
            details={"from": old_role, "to": new_role}
        )

    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    return User(**updated_user)

@api_router.put("/users/{user_id}/status", response_model=User)
async def update_user_status(user_id: str, request: UpdateUserStatusRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="No tienes permisos para cambiar el estado de un usuario")
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio estado")

    user_to_update = await db.users.find_one({"id": user_id})
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    await db.users.update_one({"id": user_id}, {"$set": {"is_active": request.is_active}})
    await log_activity(
        actor=current_user,
        action="Cambio de estado",
        target_user=user_to_update,
        details={"status": "activado" if request.is_active else "desactivado"}
    )
    
    return User(**user_to_update)

@api_router.post("/users/import")
async def import_users(request: UserImportRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para importar usuarios"
        )

    created_count = 0
    skipped_count = 0
    errors = []

    for i, user_data in enumerate(request.users):
        try:
            existing_user = await db.users.find_one({"email": user_data.email})
            if existing_user:
                skipped_count += 1
                continue

            if user_data.user_type in [UserType.UNIVERSIDAD, UserType.REPRESENTANTE]:
                if not user_data.university_id:
                    errors.append(f"Fila {i + 2}: Falta 'university_id' para el rol '{user_data.user_type.value}'")
                    continue
                university = await db.universities.find_one({"id": user_data.university_id})
                if not university:
                    errors.append(f"Fila {i + 2}: No se encontró universidad con ID '{user_data.university_id}'")
                    continue

            new_user = User(**user_data.model_dump())
            user_dict = new_user.model_dump()
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            await db.users.insert_one(user_dict)
            created_count += 1
        except Exception as e:
            errors.append(f"Fila {i + 2}: Error inesperado - {str(e)}")

    return {
        "message": "Importación completada.",
        "created": created_count,
        "skipped": skipped_count,
        "errors": errors
    }

@api_router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar usuarios"
        )
    
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propia cuenta"
        )

    # Find user to delete
    user_to_delete = await db.users.find_one({"id": user_id})
    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    # 1. Delete user sessions
    await db.user_sessions.delete_many({"user_id": user_id})

    # 2. Delete user progress
    await db.user_progress.delete_many({"user_id": user_id})

    # 3. Remove user from content assignments
    await db.content_assignments.update_many({}, {"$pull": {"assigned_to_user_ids": user_id}})
    
    # 4. Delete the user
    await db.users.delete_one({"id": user_id})

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response = JSONResponse(content={"success": True})
    response.delete_cookie(key="session_token", path="/")
    return response

# Activity Log endpoint
@api_router.get("/activity-log", response_model=List[ActivityLog])
async def get_activity_log(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver el registro de actividad"
        )
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(1000)
    return [ActivityLog(**log) for log in logs]

# Universities endpoints
@api_router.get("/universities", response_model=List[University])
async def get_universities():
    universities = await db.universities.find({}, {"_id": 0}).to_list(1000)
    return [University(**u) for u in universities]

@api_router.post("/universities", response_model=University)
async def create_university(request: UniversityCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ADMIN, UserType.ESCUELA_FORMACION]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear universidades"
        )
    
    university = University(name=request.name, description=request.description)
    university_dict = university.model_dump()
    university_dict["created_at"] = university_dict["created_at"].isoformat()
    await db.universities.insert_one(university_dict)
    
    return university

# Categories endpoints
@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return [Category(**c) for c in categories]

@api_router.post("/categories", response_model=Category)
async def create_category(request: CategoryCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ADMIN, UserType.ESCUELA_FORMACION]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear categorías"
        )

    # Check if category already exists (case-insensitive)
    existing_category = await db.categories.find_one({"name": {"$regex": f"^{request.name}$", "$options": "i"}})
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La categoría '{request.name}' ya existe"
        )

    category = Category(name=request.name)
    category_dict = category.model_dump()
    category_dict["created_at"] = category_dict["created_at"].isoformat()
    await db.categories.insert_one(category_dict)

    return category

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, request: CategoryCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ADMIN, UserType.ESCUELA_FORMACION]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar categorías"
        )

    # Check if another category with the same name exists (case-insensitive)
    existing_category = await db.categories.find_one({
        "name": {"$regex": f"^{request.name}$", "$options": "i"},
        "id": {"$ne": category_id}
    })
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La categoría '{request.name}' ya existe"
        )

    update_result = await db.categories.update_one(
        {"id": category_id},
        {"$set": {"name": request.name}}
    )

    if update_result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    updated_category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return Category(**updated_category)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ADMIN, UserType.ESCUELA_FORMACION]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar categorías")

    await db.training_contents.update_many({}, {"$pull": {"category_ids": category_id}})
    delete_result = await db.categories.delete_one({"id": category_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return {"message": "Categoría eliminada exitosamente"}

# Training Content endpoints
@api_router.get("/content", response_model=List[TrainingContent])
async def get_training_content(current_user: User = Depends(get_current_user)):
    if current_user.user_type in [UserType.REPRESENTANTE, UserType.COLABORACION_EXTERNA]:
        # Get assigned and public content
        content_ids = set()

        # Get assigned content IDs
        assignments = await db.content_assignments.find({
            "$or": [
                {"assigned_to_user_ids": current_user.id},
                {"assigned_to_all_representatives": True}
            ]
        }, {"_id": 0}).to_list(1000)
        for a in assignments:
            content_ids.add(a["content_id"])

        # Get public content IDs
        public_contents = await db.training_contents.find({"is_public": True}, {"id": 1}).to_list(1000)
        for pc in public_contents:
            content_ids.add(pc["id"])

        contents = await db.training_contents.find(
            {"id": {"$in": list(content_ids)}},
            {"_id": 0}
        ).to_list(1000)
    else:
        # Other users see all content
        contents = await db.training_contents.find({}, {"_id": 0}).to_list(1000)
    
    return [TrainingContent(**c) for c in contents]

@api_router.post("/content", response_model=TrainingContent)
async def create_training_content(request: TrainingContentCreate, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ESCUELA_FORMACION, UserType.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear contenido formativo"
        )

    # Validate category_ids
    if request.category_ids:
        categories_count = await db.categories.count_documents({"id": {"$in": request.category_ids}})
        if categories_count != len(request.category_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Una o más categorías proporcionadas no son válidas"
            )
    
    files = [ContentFile(**f.model_dump()) for f in request.files]
    quizzes = [
        Quiz(
            title=q.title,
            questions=[Question(**qs.model_dump()) for qs in q.questions],
            passing_percentage=q.passing_percentage
        )
        for q in request.quizzes
    ]
    
    content = TrainingContent(
        title=request.title,
        description=request.description,
        is_public=request.is_public,
        files=files,
        category_ids=request.category_ids,
        quizzes=quizzes,
        created_by=current_user.id
    )
    
    content_dict = content.model_dump()
    content_dict["created_at"] = content_dict["created_at"].isoformat()
    await db.training_contents.insert_one(content_dict)
    
    return content

@api_router.get("/content/{content_id}", response_model=TrainingContent)
async def get_training_content_by_id(content_id: str, current_user: User = Depends(get_current_user)):
    content = await db.training_contents.find_one({"id": content_id}, {"_id": 0})
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contenido no encontrado"
        )
    
    return TrainingContent(**content)

@api_router.delete("/content/{content_id}")
async def delete_training_content(content_id: str, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ESCUELA_FORMACION, UserType.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para eliminar contenido formativo"
        )

    # Delete the content
    delete_result = await db.training_contents.delete_one({"id": content_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")

    return {"message": "Content deleted successfully"}

# Assignments endpoints
@api_router.post("/assignments")
async def assign_content(request: AssignContentRequest, current_user: User = Depends(get_current_user)):
    # Verify content exists
    content = await db.training_contents.find_one({"id": request.content_id}, {"_id": 0})
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contenido no encontrado"
        )
    
    # Check permissions
    if current_user.user_type == UserType.JUNTA_DIRECTIVA:
        # Can assign to all representatives
        assignment = ContentAssignment(
            content_id=request.content_id,
            assigned_to_all_representatives=True,
            assigned_by=current_user.id
        )
    elif current_user.user_type == UserType.UNIVERSIDAD:
        # Can assign only to representatives of their university
        if not request.user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debes especificar usuarios"
            )
        
        # Verify users belong to their university
        users = await db.users.find(
            {"id": {"$in": request.user_ids}},
            {"_id": 0}
        ).to_list(1000)
        
        for user in users:
            if user.get("university_id") != current_user.university_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo puedes asignar contenido a representantes de tu universidad"
                )
        
        assignment = ContentAssignment(
            content_id=request.content_id,
            assigned_to_user_ids=request.user_ids,
            assigned_by=current_user.id
        )
    elif current_user.user_type in [UserType.ESCUELA_FORMACION, UserType.ADMIN]:
        # Can assign to anyone
        assignment = ContentAssignment(
            content_id=request.content_id,
            assigned_to_user_ids=request.user_ids or [],
            assigned_to_all_representatives=request.assign_to_all_representatives,
            assigned_by=current_user.id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para asignar contenido"
        )
    
    assignment_dict = assignment.model_dump()
    assignment_dict["created_at"] = assignment_dict["created_at"].isoformat()
    await db.content_assignments.insert_one(assignment_dict)
    
    return assignment

@api_router.get("/assignments", response_model=List[ContentAssignment])
async def get_all_assignments(current_user: User = Depends(get_current_user)):
    if current_user.user_type != UserType.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver todas las asignaciones"
        )
    assignments = await db.content_assignments.find({}, {"_id": 0}).to_list(1000)
    return [ContentAssignment(**a) for a in assignments]

@api_router.post("/assignments/unassign")
async def unassign_content(request: UnassignContentRequest, current_user: User = Depends(get_current_user)):
    if current_user.user_type not in [UserType.ADMIN, UserType.ESCUELA_FORMACION]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para quitar asignaciones de contenido"
        )

    # Find all assignments for this content and pull the user_id
    await db.content_assignments.update_many(
        {"content_id": request.content_id},
        {"$pull": {"assigned_to_user_ids": request.user_id}}
    )

    # Also delete any progress the user had for that content
    await db.user_progress.delete_many({"user_id": request.user_id, "content_id": request.content_id})

    return {"message": "Formación retirada exitosamente"}

@api_router.get("/representatives")
async def get_representatives(current_user: User = Depends(get_current_user)):
    if current_user.user_type == UserType.UNIVERSIDAD:
        # Get only representatives from their university
        users = await db.users.find(
            {
                "user_type": UserType.REPRESENTANTE,
                "university_id": current_user.university_id
            },
            {"_id": 0}
        ).to_list(1000)
    elif current_user.user_type in [UserType.JUNTA_DIRECTIVA, UserType.ESCUELA_FORMACION, UserType.ADMIN]:
        # Get all representatives
        users = await db.users.find(
            {"user_type": UserType.REPRESENTANTE},
            {"_id": 0}
        ).to_list(1000)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos"
        )
    
    return [User(**u) for u in users]

# Progress endpoints
@api_router.get("/progress")
async def get_my_progress(current_user: User = Depends(get_current_user)):
    progress_list = await db.user_progress.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).to_list(1000)
    
    return [UserProgress(**p) for p in progress_list]

@api_router.post("/progress/file-completed")
async def mark_file_completed(request: MarkFileCompletedRequest, current_user: User = Depends(get_current_user)):
    # Get or create progress
    progress = await db.user_progress.find_one(
        {"user_id": current_user.id, "content_id": request.content_id},
        {"_id": 0}
    )
    
    if not progress:
        progress = UserProgress(
            user_id=current_user.id,
            content_id=request.content_id
        ).model_dump()
        progress["last_updated"] = progress["last_updated"].isoformat()
        await db.user_progress.insert_one(progress)
    
    # Add file to completed list if not already there
    if request.file_id not in progress.get("files_completed", []):
        await db.user_progress.update_one(
            {"user_id": current_user.id, "content_id": request.content_id},
            {
                "$push": {"files_completed": request.file_id},
                "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    updated_progress = await db.user_progress.find_one(
        {"user_id": current_user.id, "content_id": request.content_id},
        {"_id": 0}
    )
    
    return UserProgress(**updated_progress)

@api_router.post("/progress/submit-quiz")
async def submit_quiz(request: SubmitQuizRequest, current_user: User = Depends(get_current_user)):
    # Get content
    content = await db.training_contents.find_one({"id": request.content_id}, {"_id": 0})
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contenido no encontrado"
        )
    
    # Find quiz
    quiz = None
    for q in content.get("quizzes", []):
        if q["id"] == request.quiz_id:
            quiz = q
            break
    
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuestionario no encontrado"
        )
    
    # Calculate score
    total_questions = len(quiz["questions"])
    correct_answers = 0
    
    for question in quiz["questions"]:
        user_answer = request.answers.get(question["id"], [])
        correct = set(question["correct_answers"])
        
        if set(user_answer) == correct:
            correct_answers += 1
    
    score = (correct_answers / total_questions) * 100
    passed = score >= quiz["passing_percentage"]
    
    # Get or create progress
    progress = await db.user_progress.find_one(
        {"user_id": current_user.id, "content_id": request.content_id},
        {"_id": 0}
    )
    
    if not progress:
        progress = UserProgress(
            user_id=current_user.id,
            content_id=request.content_id
        ).model_dump()
        progress["last_updated"] = progress["last_updated"].isoformat()
        await db.user_progress.insert_one(progress)
    
    # Update quiz completion
    quiz_data = progress.get("quizzes_completed", {}).get(request.quiz_id, {"attempts": 0})
    quiz_data["score"] = score
    quiz_data["passed"] = passed
    quiz_data["attempts"] = quiz_data.get("attempts", 0) + 1
    
    await db.user_progress.update_one(
        {"user_id": current_user.id, "content_id": request.content_id},
        {
            "$set": {
                f"quizzes_completed.{request.quiz_id}": quiz_data,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Check if all files and quizzes are completed
    updated_progress = await db.user_progress.find_one(
        {"user_id": current_user.id, "content_id": request.content_id},
        {"_id": 0}
    )
    
    all_files_completed = len(updated_progress.get("files_completed", [])) == len(content.get("files", []))
    all_quizzes_passed = all(
        updated_progress.get("quizzes_completed", {}).get(q["id"], {}).get("passed", False)
        for q in content.get("quizzes", [])
    )
    
    if all_files_completed and all_quizzes_passed:
        await db.user_progress.update_one(
            {"user_id": current_user.id, "content_id": request.content_id},
            {"$set": {"completed": True}}
        )
    
    return {
        "score": score,
        "passed": passed,
        "correct_answers": correct_answers,
        "total_questions": total_questions,
        "attempts": quiz_data["attempts"]
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
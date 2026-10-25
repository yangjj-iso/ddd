from decimal import Decimal
from typing import Literal
from typing import Generic, TypeVar
from pydantic import BaseModel, Field, field_validator

CATEGORIES = [
    "电阻",
    "电容",
    "电感",
    "集成电路",
    "二极管",
    "晶体管",
    "连接器",
    "模块",
    "其他",
]


class Login(BaseModel):
    username: str = Field(max_length=80)
    password: str = Field(max_length=200)


class PartInput(BaseModel):
    sku: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=160)
    category: str
    manufacturer: str = Field(default="", max_length=100)
    package: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=500)
    min_quantity: int = Field(default=10, ge=0, le=1000000000)
    unit_price: Decimal = Field(
        default=Decimal("0"), ge=0, le=99999999, decimal_places=4
    )
    location_id: int | None = Field(default=None, gt=0)
    specs: dict[str, str] = Field(default_factory=dict, max_length=30)
    datasheet_url: str = Field(default="", max_length=1000)
    notes: str = Field(default="", max_length=5000)

    @field_validator("category")
    @classmethod
    def valid_category(cls, value):
        if value not in CATEGORIES:
            raise ValueError("请选择有效的物料分类")
        return value

    @field_validator("sku", "name")
    @classmethod
    def strip_required(cls, value):
        if not value.strip():
            raise ValueError("不能为空")
        return value.strip()

    @field_validator("datasheet_url")
    @classmethod
    def safe_url(cls, value):
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("数据手册必须是 http 或 https 链接")
        return value


class PartCreate(PartInput):
    quantity: int = Field(default=0, ge=0, le=1000000000)


class StockInput(BaseModel):
    kind: Literal["in", "out"]
    quantity: int = Field(gt=0, le=1000000000)
    reason: str = Field(min_length=1, max_length=300)


class LocationInput(BaseModel):
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_\-]+$")
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    capacity: int = Field(default=30, ge=1, le=100000)


class KeyInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    scope: Literal["read", "write"] = "read"


class LineInput(BaseModel):
    part_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=1000000)
    designator: str = Field(default="", max_length=100)


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    build_quantity: int = Field(default=1, ge=1, le=1000000)
    lines: list[LineInput] = Field(default_factory=list, max_length=300)


# Explicit response contracts keep OpenAPI useful for agent tool generation.
class AuthOut(BaseModel):
    name: str
    scope: Literal["read", "write"]
    admin: bool


class PartLocationOut(BaseModel):
    id: int
    code: str
    name: str


class LocationOut(PartLocationOut):
    description: str
    capacity: int
    part_count: int
    quantity: int


class PartOut(PartInput):
    id: int
    quantity: int
    location: PartLocationOut | None
    is_demo: bool
    created_at: str = Field(description="UTC ISO 8601 timestamp")
    updated_at: str = Field(description="UTC ISO 8601 timestamp")


class MovementOut(BaseModel):
    id: int
    part_id: int
    part_name: str
    part_sku: str
    category: str
    kind: Literal["in", "out"]
    quantity: int
    balance: int
    reason: str
    actor: str
    created_at: str = Field(description="UTC ISO 8601 timestamp")


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class CategoryCount(BaseModel):
    name: str
    count: int
    quantity: int


class TrendDay(BaseModel):
    date: str
    incoming: int = Field(alias="in")
    outgoing: int = Field(alias="out")


class SummaryOut(BaseModel):
    total_parts: int
    total_quantity: int
    total_value: float = Field(description="Inventory valuation in CNY")
    low_stock: int = Field(
        description="Number of parts with quantity <= min_quantity, including out-of-stock parts"
    )
    out_of_stock: int
    demo_parts: int
    location_count: int
    categories: list[CategoryCount]
    recent_movements: list[MovementOut]
    trend: list[TrendDay]


class KeyOut(BaseModel):
    id: int
    name: str
    prefix: str
    scope: Literal["read", "write"]
    created_at: str
    last_used_at: str | None
    revoked: bool


class CreatedKeyOut(BaseModel):
    id: int
    name: str
    scope: Literal["read", "write"]
    token: str = Field(description="Shown only once; store securely")


class BomLineOut(BaseModel):
    part_id: int
    quantity: int
    designator: str
    part_name: str
    part_sku: str
    stock: int
    required: int
    missing: int


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    build_quantity: int
    ready: bool
    cost: float
    lines: list[BomLineOut]

"""Pydantic request / response schemas."""

from app.schemas.admin import AdminLoginIn, AdminMeOut, AdminOut
from app.schemas.auth import (
    ForgotPasswordIn,
    LogoutIn,
    RefreshIn,
    ResetPasswordIn,
    TokenPairOut,
    UserAuthOut,
    UserBrief,
    UserLoginIn,
    UserRegisterIn,
)
from app.schemas.common import OkModel, PaginatedOut, PaginationIn
from app.schemas.merchant import (
    MerchantAccountOut,
    MerchantAccountWithPasswordOut,
    MerchantChangePasswordIn,
    MerchantLoginIn,
    MerchantMeOut,
    ShopOut,
    ShopUpdateIn,
)
from app.schemas.merchant_application import (
    MerchantApplicationCreateIn,
    MerchantApplicationListQuery,
    MerchantApplicationOut,
    MerchantApplicationReviewIn,
)
from app.schemas.user import ChangePasswordIn, UserMeOut, UserOut, UserUpdateIn

__all__ = [
    "AdminLoginIn",
    "AdminMeOut",
    "AdminOut",
    "ChangePasswordIn",
    "ForgotPasswordIn",
    "LogoutIn",
    "MerchantAccountOut",
    "MerchantAccountWithPasswordOut",
    "MerchantApplicationCreateIn",
    "MerchantApplicationListQuery",
    "MerchantApplicationOut",
    "MerchantApplicationReviewIn",
    "MerchantChangePasswordIn",
    "MerchantLoginIn",
    "MerchantMeOut",
    "OkModel",
    "PaginatedOut",
    "PaginationIn",
    "RefreshIn",
    "ResetPasswordIn",
    "ShopOut",
    "ShopUpdateIn",
    "TokenPairOut",
    "UserAuthOut",
    "UserBrief",
    "UserLoginIn",
    "UserMeOut",
    "UserOut",
    "UserRegisterIn",
    "UserUpdateIn",
]

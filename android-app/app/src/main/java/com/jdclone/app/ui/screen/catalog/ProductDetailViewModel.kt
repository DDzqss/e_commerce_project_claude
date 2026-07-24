package com.jdclone.app.ui.screen.catalog

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.SkuDto
import com.jdclone.app.data.network.dto.SpuDetailDto
import com.jdclone.app.data.network.dto.SpuListItemDto
import com.jdclone.app.data.repository.CartRepository
import com.jdclone.app.data.repository.CatalogRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProductDetailState(
    val detail: SpuDetailDto,
    val related: List<SpuListItemDto> = emptyList(),
    val selectedSpecs: Map<String, String> = emptyMap(),
    val quantity: Int = 1,
    val addingToCart: Boolean = false,
    val toast: String? = null,
) {
    /** 根据当前 [selectedSpecs] 匹配到具体 SKU；specs 不足时返回 null。 */
    val selectedSku: SkuDto?
        get() {
            val axes = detail.specAxes
            if (axes.isEmpty()) return detail.skus.firstOrNull { it.isActive }
            if (selectedSpecs.size < axes.size) return null
            return detail.skus.firstOrNull { sku ->
                axes.all { axis -> sku.specs[axis] == selectedSpecs[axis] }
            }
        }
}

@HiltViewModel
class ProductDetailViewModel @Inject constructor(
    private val catalog: CatalogRepository,
    private val cart: CartRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val spuId: Long = savedStateHandle.get<String>("id")?.toLongOrNull() ?: 0L

    private val _state = MutableStateFlow<UiState<ProductDetailState>>(UiState.Loading)
    val state: StateFlow<UiState<ProductDetailState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            catalog.getSpuDetail(spuId).fold(
                onSuccess = { detail ->
                    // 默认选中第一个可用 SKU 的 specs
                    val defaultSku = detail.skus.firstOrNull { it.isActive && it.stock > 0 }
                        ?: detail.skus.firstOrNull()
                    val defaultSpecs = defaultSku?.specs.orEmpty()
                    _state.value = UiState.Success(
                        ProductDetailState(
                            detail = detail,
                            selectedSpecs = defaultSpecs,
                            quantity = 1,
                        ),
                    )
                    catalog.getRelated(spuId, limit = 8).getOrNull()?.let { related ->
                        val current = _state.value
                        if (current is UiState.Success) {
                            _state.value = UiState.Success(current.data.copy(related = related))
                        }
                    }
                },
                onFailure = {
                    _state.value = UiState.Error(errorMessage(it))
                },
            )
        }
    }

    fun selectSpec(axis: String, value: String) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        val newSpecs = current.selectedSpecs.toMutableMap().apply { put(axis, value) }
        _state.value = UiState.Success(current.copy(selectedSpecs = newSpecs))
    }

    fun setQuantity(qty: Int) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(quantity = qty.coerceAtLeast(1)))
    }

    fun addToCart(onDone: (success: Boolean) -> Unit) {
        val current = (_state.value as? UiState.Success)?.data ?: return
        val sku = current.selectedSku ?: run {
            _state.value = UiState.Success(current.copy(toast = "请先选择商品规格"))
            return
        }
        _state.value = UiState.Success(current.copy(addingToCart = true, toast = null))
        viewModelScope.launch {
            val r = cart.add(sku.id, current.quantity)
            _state.value = UiState.Success(
                current.copy(
                    addingToCart = false,
                    toast = r.fold(
                        onSuccess = { "已加入购物车" },
                        onFailure = { errorMessage(it) },
                    ),
                ),
            )
            onDone(r.isSuccess)
        }
    }

    fun clearToast() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        _state.value = UiState.Success(current.copy(toast = null))
    }
}

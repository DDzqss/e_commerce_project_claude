package com.jdclone.app.ui.screen.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.CategoryDto
import com.jdclone.app.data.network.PageData
import com.jdclone.app.data.network.dto.SpuListItemDto
import com.jdclone.app.data.repository.CatalogRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.toUiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeState(
    val categories: List<CategoryDto> = emptyList(),
    val recommendations: List<SpuListItemDto> = emptyList(),
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repo: CatalogRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<HomeState>>(UiState.Loading)
    val state: StateFlow<UiState<HomeState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            val categoriesResult = repo.listCategories()
            val recommendationsResult = repo.getRecommendations(limit = 10)
            _state.value = if (categoriesResult.isSuccess && recommendationsResult.isSuccess) {
                UiState.Success(
                    HomeState(
                        categories = categoriesResult.getOrThrow(),
                        recommendations = recommendationsResult.getOrThrow(),
                    ),
                )
            } else {
                val failure = categoriesResult.exceptionOrNull()
                    ?: recommendationsResult.exceptionOrNull()!!
                Result.failure<HomeState>(failure).toUiState()
            }
        }
    }
}

data class CategoryListState(
    val category: CategoryDto? = null,
    val page: PageData<SpuListItemDto>? = null,
    val loadingMore: Boolean = false,
    val allLoaded: Boolean = false,
    val accumulated: List<SpuListItemDto> = emptyList(),
)

@HiltViewModel
class CategoryListViewModel @Inject constructor(
    private val repo: CatalogRepository,
    savedStateHandle: androidx.lifecycle.SavedStateHandle,
) : ViewModel() {
    private val categoryId: Long = savedStateHandle.get<String>("id")?.toLongOrNull() ?: 0L

    private val _state = MutableStateFlow<UiState<CategoryListState>>(UiState.Loading)
    val state: StateFlow<UiState<CategoryListState>> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            val listResult = repo.listSpus(
                categoryId = categoryId.takeIf { it > 0 },
                page = 1,
                size = 20,
            )
            val treeResult = repo.listCategories()
            listResult.fold(
                onSuccess = { page ->
                    val category = treeResult.getOrNull()?.let { findCategory(it, categoryId) }
                    _state.value = UiState.Success(
                        CategoryListState(
                            category = category,
                            page = page,
                            accumulated = page.items,
                            allLoaded = page.items.size >= page.total,
                        ),
                    )
                },
                onFailure = { _state.value = Result.failure<CategoryListState>(it).toUiState() },
            )
        }
    }

    fun loadMore() {
        val current = (_state.value as? UiState.Success)?.data ?: return
        if (current.loadingMore || current.allLoaded) return
        val nextPage = (current.page?.page ?: 1) + 1
        _state.value = UiState.Success(current.copy(loadingMore = true))
        viewModelScope.launch {
            repo.listSpus(
                categoryId = categoryId.takeIf { it > 0 },
                page = nextPage,
                size = 20,
            ).fold(
                onSuccess = { page ->
                    val combined = current.accumulated + page.items
                    _state.value = UiState.Success(
                        current.copy(
                            page = page,
                            accumulated = combined,
                            loadingMore = false,
                            allLoaded = combined.size >= page.total,
                        ),
                    )
                },
                onFailure = { _state.value = UiState.Success(current.copy(loadingMore = false)) },
            )
        }
    }

    private fun findCategory(tree: List<CategoryDto>, id: Long): CategoryDto? {
        tree.forEach { root ->
            if (root.id == id) return root
            val found = findCategory(root.children, id)
            if (found != null) return found
        }
        return null
    }
}

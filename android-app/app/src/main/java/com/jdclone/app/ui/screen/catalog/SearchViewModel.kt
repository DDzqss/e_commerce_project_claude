package com.jdclone.app.ui.screen.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.jdclone.app.data.network.dto.SpuListItemDto
import com.jdclone.app.data.repository.CatalogRepository
import com.jdclone.app.ui.common.UiState
import com.jdclone.app.ui.common.errorMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SearchState(
    val keyword: String = "",
    val results: List<SpuListItemDto> = emptyList(),
    val loading: Boolean = false,
    val allLoaded: Boolean = false,
    val page: Int = 1,
    val error: String? = null,
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val repo: CatalogRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SearchState())
    val state: StateFlow<SearchState> = _state.asStateFlow()

    fun updateKeyword(k: String) {
        _state.value = _state.value.copy(keyword = k)
    }

    fun search() {
        val kw = _state.value.keyword.trim()
        if (kw.isBlank()) return
        _state.value = SearchState(keyword = kw, loading = true)
        viewModelScope.launch {
            repo.listSpus(keyword = kw, page = 1, size = 20).fold(
                onSuccess = { page ->
                    _state.value = _state.value.copy(
                        results = page.items,
                        loading = false,
                        allLoaded = page.items.size >= page.total,
                        page = 1,
                    )
                },
                onFailure = {
                    _state.value = _state.value.copy(loading = false, error = errorMessage(it))
                },
            )
        }
    }

    fun loadMore() {
        val current = _state.value
        if (current.loading || current.allLoaded || current.keyword.isBlank()) return
        _state.value = current.copy(loading = true)
        val next = current.page + 1
        viewModelScope.launch {
            repo.listSpus(keyword = current.keyword, page = next, size = 20).fold(
                onSuccess = { page ->
                    _state.value = _state.value.copy(
                        results = _state.value.results + page.items,
                        loading = false,
                        page = next,
                        allLoaded = (_state.value.results.size + page.items.size) >= page.total,
                    )
                },
                onFailure = { _state.value = _state.value.copy(loading = false) },
            )
        }
    }
}

import { UrlXStoreModule } from './types';
import { urlParams } from './getters/url-params.getter';

/**
 * {@link XStoreModule} For the URL module.
 *
 * @internal
 */
export const urlXStoreModule: UrlXStoreModule = {
  state: () => ({
    config: {
      urlParamNames: {}
    },
    query: '',
    page: 1,
    filters: [],
    sort: '',
    relatedTags: [],
    extraParams: {}
  }),
  getters: {
    urlParams
  },
  mutations: {
    setUrlConfig(state, urlConfig) {
      state.config = urlConfig;
    }
  },
  actions: {}
};
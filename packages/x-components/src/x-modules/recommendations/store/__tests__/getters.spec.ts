import Vue from 'vue';
import Vuex, { Store } from 'vuex';
import { TopRecommendationsRequest } from '@empathyco/x-adapter';
import { map } from '../../../../utils';
import { RECOMMENDATIONS_ORIGIN } from '../constants';
import { recommendationsXStoreModule } from '../module';
import { RecommendationsState } from '../types';
import { resetRecommendationsStateWith } from './utils';

describe('testing recommendations module getters', () => {
  Vue.use(Vuex);
  const gettersKeys = map(recommendationsXStoreModule.getters, getter => getter);
  const store: Store<RecommendationsState> = new Store(recommendationsXStoreModule as any);

  describe(`${gettersKeys.request} getter`, () => {
    it('should return a request object with config default values', () => {
      resetRecommendationsStateWith(store, {
        config: { maxItemsToRequest: 3 },
        params: { catalog: 'es' }
      });
      expect(store.getters[gettersKeys.request]).toEqual<
        TopRecommendationsRequest & { [key: string]: unknown }
      >({
        rows: 3,
        start: 0,
        origin: RECOMMENDATIONS_ORIGIN,
        catalog: 'es'
      });
    });
  });
});
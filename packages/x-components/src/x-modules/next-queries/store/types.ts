import { NextQueriesRequest } from '@empathy/search-adapter';
import { NextQuery } from '@empathy/search-types';
import { XStoreModule } from '../../../store';
import { NextQueriesConfig } from '../config.types';

export interface NextQueriesState {
  query: string;
  nextQueries: NextQuery[];
  config: NextQueriesConfig;
}

export interface NextQueriesGetters {
  request: NextQueriesRequest | null;
}

export interface NextQueriesMutations {
  setQuery(newQuery: string): void;
  setNextQueries(nextQueries: NextQuery[]): void;
}

export interface NextQueriesActions {
  getNextQueries(): NextQuery[];
  retrieveNextQueries(): void;
}

export type NextQueriesXStoreModule = XStoreModule<
  NextQueriesState,
  NextQueriesGetters,
  NextQueriesMutations,
  NextQueriesActions
>;

import { ActionContext } from 'vuex';
import { Dictionary, PropsWithType } from '../utils';
import { MutationsDictionary } from './mutations.types';
import { ExtractPayload, RootXStoreState } from './store.types';

/**
 * Type safe Vuex {@link ActionContext}, with the local types of the module
 * @param State the module state dictionary type definition
 * @param Getters the module getters dictionary type definition
 * @param Mutations the module mutation dictionary type definition
 * @param Actions the module actions dictionary type definition
 */
export interface XActionContext<
  State extends Dictionary,
  Getters extends Dictionary,
  Mutations extends MutationsDictionary<Mutations>,
  Actions extends ActionsDictionary<Actions>
> extends ActionContext<State, RootXStoreState> {
  getters: Getters;
  commit<MutationName extends PropsWithType<Mutations, () => void>>(mutation: MutationName): void;
  commit<MutationName extends keyof Mutations>(
    mutation: MutationName,
    payload: ExtractPayload<Mutations[MutationName]>
  ): void;
  dispatch<ActionName extends PropsWithType<Actions, () => any>>(
    action: ActionName
  ): ExtractActionReturn<Actions[ActionName]>;
  dispatch<ActionName extends keyof Actions>(
    action: ActionName,
    payload: ExtractPayload<Actions[ActionName]>
  ): ExtractActionReturn<Actions[ActionName]>;
}

/**
 * Flattens the (probably) chained promises of an action type
 * @param Action the action function to extract its type
 */
export type ExtractActionReturn<Action extends (payload?: any) => any> = ReturnType<
  Action
> extends Promise<any>
  ? ReturnType<Action>
  : Promise<ReturnType<Action>>;

/**
 * Util type for being used on generic constraints which will only accept an object containing actions
 * @example ```typescript
 *  // This function allows receiving any object who only contains actions;
 *  function sampleFunction<Actions extends ActionsDictionary<Actions>>(actions: Actions): void;
 * ```
 */
export type ActionsDictionary<Actions> = Record<keyof Actions, (payload?: any) => any>;

/**
 * Type-safe actions definition type. An object with this type is what it is needed to define {@link Vuex} actions
 * @param State the module state dictionary type definition
 * @param Getters the module getters dictionary type definition
 * @param Mutations the module mutation dictionary type definition
 * @param Actions the module actions dictionary type definition
 */
export type ActionsTree<
  State extends Dictionary,
  Getters extends Dictionary,
  Mutations extends MutationsDictionary<Mutations>,
  Actions extends ActionsDictionary<Actions>
> = {
  [Key in keyof Actions]: (
    context: XActionContext<State, Getters, Mutations, Actions>,
    payload: ExtractPayload<Actions[Key]>
  ) => ReturnType<Actions[Key]> | Promise<ReturnType<Actions[Key]>>;
};

/**
 * Alias for any actions tree. Use only when you really don't care about the actions type
 */
export type AnyActionsTree = ActionsTree<
  Dictionary,
  Dictionary,
  MutationsDictionary<any>,
  ActionsDictionary<any>
>;

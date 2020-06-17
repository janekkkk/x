import { SearchAdapter } from '@empathy/search-adapter';
import { deepMerge } from '@empathybroker/deep-merge';
import { PluginObject, VueConstructor } from 'vue';
import Vuex, { Module, Store } from 'vuex';
import { FILTERS_REGISTRY } from '../filters/filters.registry';
import { registerReactiveConfig } from '../services/config.service';
import {
  AnySimpleStateSelector,
  AnyStateSelector,
  AnyStoreEmitters
} from '../store/store-emitters.types';
import { AnyXStoreModule } from '../store/store.types';
import { getGettersProxyFromModule } from '../store/utils/get-getters-proxy';
import { RootXStoreModule } from '../store/x.module';
import { DeepPartial, Dictionary, forEach } from '../utils';
import { AnyWire, Wiring } from '../wiring/wiring.types';
import { AnyXModule, XModuleName } from '../x-modules/x-modules.types';
import { bus } from './x-bus';
import { XBus } from './x-bus.types';
import { DEFAULT_X_CONFIG } from './x-plugin.config';
import { createXComponentAPIMixin } from './x-plugin.mixin';
import { AnyXStoreModuleOptions, XConfig, XModuleOptions, XPluginOptions } from './x-plugin.types';
import { assertXPluginOptionsAreValid } from './x-plugin.utils';

/**
 * Vue plugin that initializes the properties needed by the x-components, and exposes the events bus
 * and the adapter after it has been installed.
 *
 * @public
 */
export class XPlugin implements PluginObject<XPluginOptions> {
  /**
   * {@link @empathy/search-adapter#SearchAdapter | SearchAdapter} Is the middleware between
   * the components and our API where data can be mapped to client needs.
   * This property is only available after installing the plugin.
   *
   * @returns The installed adapter.
   * @throws If this property is accessed before calling `Vue.use(xPlugin)`.
   * @public
   */
  public static get adapter(): SearchAdapter {
    return this.getInstance().adapter;
  }

  /**
   * Exposed {@link XBus}, so any kind of application can subscribe to {@link XEventsTypes}
   * without having to pass through a component.
   * This property is only available after installing the plugin.
   *
   * @returns The installed bus.
   * @throws If this property is accessed before calling `Vue.use(xPlugin)`.
   * @public
   */
  public static get bus(): XBus {
    return this.getInstance().bus;
  }

  /**
   * Gets the global reactive {@link XConfig}.
   *
   * @returns Config - The xConfig.
   * @public
   */
  public static get config(): XConfig {
    return this.getInstance().xConfig;
  }

  /**
   * Safely retrieves the installed instance of the XPlugin.
   *
   * @returns The installed instance of the XPlugin.
   * @throws If this method is called before calling `Vue.use(xPlugin)`.
   * @internal
   */
  protected static getInstance(): XPlugin {
    if (!this.instance) {
      throw Error("XPlugin must be installed before accessing it's API.");
    }
    return this.instance;
  }

  /**
   * Record of modules that have been tried to be installed before the installation of the plugin.
   *
   * @internal
   */
  protected static pendingXModules: Partial<Record<XModuleName, AnyXModule>> = {};

  /**
   * Instance of the installed plugin. Used to expose the bus and the adapter.
   *
   * @internal
   */
  protected static instance?: XPlugin;

  /**
   * Bus for retrieving the observables when registering the wiring.
   *
   * @internal
   */
  protected bus: XBus;

  /**
   * Adapter for the API, responsible for transforming requests and responses.
   *
   * @internal
   */
  protected adapter!: SearchAdapter;

  /**
   * Set of the already installed {@link XModule | XModules} to avoid re-registering them.
   *
   * @internal
   */
  protected installedXModules = new Set<string>();

  /**
   * True if the plugin has been installed in a Vue instance, in this case
   * {@link XModule |Xmodules} will be installed immediately. False otherwise, in this case
   * {@link XModule | XModules} will be installed lazily when the {@link XPlugin#install} method
   * is called.
   *
   * @internal
   */
  protected isInstalled = false;

  /**
   * The install options of the plugin, where all the customization of
   * {@link XModule | XModules} is done.
   *
   * @internal
   */
  protected options!: XPluginOptions;

  /**
   * The Vuex store, to pass to the wires for its registration, and to register the store
   * modules on it.
   *
   * @internal
   */
  protected store!: Store<any>;
  /**
   * The global Vue, passed by the install method. Used to apply the global mixin
   * {@link createXComponentAPIMixin}, and install the {@link https://vuex.vuejs.org/ | Vuex}
   * plugin.
   *
   * @internal
   */
  protected vue!: VueConstructor;
  /**
   * The {@link XConfig} is a reactive configuration.
   *
   * @internal
   */
  protected xConfig!: XConfig;

  /**
   * Creates a new instance of the XPlugin with the given bus passed as parameter.
   *
   * @param bus - The {@link XBus} implementation to use for the plugin.
   * @public
   */
  public constructor(bus: XBus) {
    this.bus = bus;
  }

  /**
   * If the plugin has already been installed, it immediately registers a {@link XModule}. If it
   * has not been installed yet, it stores the module in a list until the plugin is installed.
   *
   * @param xModule - The module to register.
   */
  static registerXModule(xModule: AnyXModule): void {
    if (this.instance) {
      this.instance.registerXModule(xModule);
    } else {
      this.lazyRegisterXModule(xModule);
    }
  }

  /**
   * Utility method for resetting the installed instance of the plugin.
   *
   * @remarks Use only for testing.
   *
   * @internal
   */
  static resetInstance(): void {
    this.instance = undefined;
  }

  /**
   * Stores the {@link XModule} in a dictionary, so it can be registered later in the install
   * process.
   *
   * @param xModule - The module to register.
   * @internal
   */
  protected static lazyRegisterXModule(xModule: AnyXModule): void {
    this.pendingXModules[xModule.name] = xModule;
  }

  /**
   * Installs the plugin into the Vue instance.
   *
   * @param vue - The GlobalVue object.
   * @param options - The options to install this plugin with.
   * @throws If the XPlugin has already been installed, or the options are not valid.
   * @internal
   */
  install(vue: VueConstructor, options?: XPluginOptions): void {
    if (this.isInstalled) {
      throw new Error('XPlugin has already been installed');
    }
    assertXPluginOptionsAreValid(options);
    XPlugin.instance = this;
    this.vue = vue;
    this.options = options;
    this.adapter = options.adapter;
    this.registerConfig();
    this.registerStore();
    this.applyMixins();
    this.registerFilters();
    this.registerPendingXModules();
    this.isInstalled = true;
  }

  /**
   * Overrides the existing {@link XConfig}.
   *
   * @param config - The new or partially new global {@link XConfig}.
   * @public
   */
  setConfig(config: DeepPartial<XConfig>): void {
    deepMerge(this.xConfig, config);
  }

  /**
   * Performs the registration of a {@link XModule}.
   *
   * @param xModule - The module to register.
   * @internal
   */
  protected registerXModule({ name, wiring, storeModule, storeEmitters }: AnyXModule): void {
    if (!this.installedXModules.has(name)) {
      this.registerStoreModule(name, storeModule);
      this.registerWiring(name, wiring);
      this.registerStoreEmitters(name, storeModule, storeEmitters);
      this.installedXModules.add(name);
    }
  }

  /**
   * Performs the registration of the wiring, retrieving the observable for each event, and
   * executing each wire.
   *
   * @param name - The name of the {@link XModule} of the wiring.
   * @param wiring - The wiring to register.
   * @internal
   */
  protected registerWiring(name: XModuleName, wiring: Partial<Wiring>): void {
    const wiringOptions = this.getModuleOptions(name)?.wiring;
    const customizedWiring: Partial<Wiring> = wiringOptions
      ? deepMerge({}, wiring, wiringOptions)
      : wiring;
    forEach(customizedWiring, (event, wires: Dictionary<AnyWire>) => {
      // Obtain the observable
      const observable = this.bus.on(event, true);
      // Register event wires
      forEach(wires, (_, wire) => {
        wire(observable, this.store);
      });
    });
  }

  /**
   * Registers a {@link https://vuex.vuejs.org/ | Vuex} store module under the 'x' module.
   *
   * @param name - The module name.
   * @param storeModule - The module definition to register.
   * @internal
   */
  protected registerStoreModule(name: XModuleName, storeModule: AnyXStoreModule): void {
    const storeModuleOptions = this.getModuleOptions(name)?.storeModule;
    const customizedStoreModule: Module<any, any> = storeModuleOptions
      ? this.customizeStoreModule(storeModule, storeModuleOptions)
      : storeModule;
    customizedStoreModule.namespaced = true;
    this.addConfigMutation(customizedStoreModule);
    this.store.registerModule(['x', name], customizedStoreModule);
  }

  /**
   * Adds to a {@link https://vuex.vuejs.org/ | Vuex} store module the mutation `setConfig` if
   * the module has a `config` in its state.
   *
   * @param storeModule - The module definition to add the mutation.
   * @returns The same module with the new mutation.
   *
   * @internal
   */
  protected addConfigMutation(storeModule: Module<any, any>): Module<any, any> {
    if (this.hasModuleConfig(storeModule)) {
      const moduleMutations = storeModule.mutations;
      if (!moduleMutations) {
        storeModule.mutations = {
          setConfig: this.getDefaultSetConfigMutation()
        };
      } else if (!moduleMutations.setConfig) {
        moduleMutations.setConfig = this.getDefaultSetConfigMutation();
      }
    }
    return storeModule;
  }

  /**
   * Creates a default set config mutation which simply assigns the new configuration entry to
   * the state.
   *
   * @returns A default implementation of the setConfig mutation.
   * @internal
   */
  protected getDefaultSetConfigMutation(): (state: any, config: any) => void {
    return function setConfig(state: any, config: any): void {
      Object.assign(state.config, config);
    };
  }

  /**
   * Checks if a {@link https://vuex.vuejs.org/ | Vuex} store module has `config` in the state.
   *
   * @param storeModule - The module definition to add the mutation.
   * @returns Boolean - true if the module has config in its state, false if not.
   *
   * @internal
   */
  protected hasModuleConfig(storeModule: Module<any, any>): boolean {
    return typeof storeModule.state === 'function'
      ? !!storeModule.state().config
      : !!storeModule.state.config;
  }

  /**
   * Retrieves the override options of an {@link XModule}.
   *
   * @param name - The module name.
   * @returns Options of the {@link XModule}.
   * @internal
   */
  protected getModuleOptions(name: XModuleName): XModuleOptions<AnyXModule> | undefined {
    return this.options.xModules?.[name];
  }

  /**
   * Overrides a {@link https://vuex.vuejs.org/ | Vuex} store module definition.
   *
   * @param defaultModule - The module to override its configuration.
   * @param moduleOptions - The options to override the defaultModule.
   * @returns The {@link XStoreModule} customized.
   * @internal
   */
  protected customizeStoreModule(
    { state: getState, ...actionsGettersMutations }: AnyXStoreModule,
    { state: stateOptions, ...newActionsGettersMutations }: AnyXStoreModuleOptions
  ): AnyXStoreModule {
    const customizedModule = deepMerge({}, actionsGettersMutations, newActionsGettersMutations);
    customizedModule.state = deepMerge(getState(), stateOptions);
    return customizedModule;
  }

  /**
   * Registers the store emitters, making them emit the event when the part of the state selected
   * changes.
   *
   * @param name - The module name.
   * @param storeModule - The store module to retrieve its state and getters.
   * @param storeEmitters - The store emitters to register.
   * @internal
   */
  protected registerStoreEmitters(
    name: XModuleName,
    storeModule: AnyXStoreModule,
    storeEmitters: AnyStoreEmitters
  ): void {
    const storeEmittersOptions = this.getModuleOptions(name)?.storeEmitters;
    const customizedStoreEmitters: AnyStoreEmitters = storeEmittersOptions
      ? deepMerge({}, storeEmitters, storeEmittersOptions)
      : storeEmitters;
    const safeGettersProxy = getGettersProxyFromModule(this.store.getters, name, storeModule);
    forEach(
      customizedStoreEmitters,
      (event, stateSelector: AnySimpleStateSelector | AnyStateSelector) => {
        const {
          selector,
          immediate = false,
          isDifferent = () => true,
          ...options
        } = this.isSimpleSelector(stateSelector) ? { selector: stateSelector } : stateSelector;

        this.store.watch(
          state => selector(state.x[name], safeGettersProxy),
          (newValue, oldValue) => {
            if (isDifferent(newValue, oldValue)) {
              this.bus.emit(event, newValue, { moduleName: name });
            }
          },
          options
        );

        if (immediate) {
          Promise.resolve().then(() => {
            this.bus.emit(event, selector(this.store.state.x[name], safeGettersProxy));
          });
        }
      }
    );
  }

  /**
   * Registers the {@link https://vuex.vuejs.org/ | Vuex} store. If the store has not been passed
   * through the {@link XPluginOptions} object, it creates one, and injects it in the Vue
   * prototype. Then it register an x module in the store, to safe scope all the
   * {@link XModule | XModules} dynamically installed.
   *
   * @internal
   */
  protected registerStore(): void {
    this.vue.use(Vuex); // We can safely install Vuex because if it is already installed Vue
    // will simply ignore it
    this.store =
      this.options.store ??
      new Store({
        strict: process.env.NODE_ENV !== 'production'
      });
    if (!this.options.store) {
      this.vue.prototype.$store = this.store;
    }
    this.store.registerModule('x', RootXStoreModule);
  }

  /**
   * Applies the {@link createXComponentAPIMixin} mixin in the global Vue.
   *
   * @internal
   */
  protected applyMixins(): void {
    this.vue.mixin(createXComponentAPIMixin(this.bus, this.xConfig));
  }

  /**
   * Registers the pending {@link XModule | XModules}, that requested to be registered before the
   * installation of the plugin.
   *
   * @internal
   */
  protected registerPendingXModules(): void {
    forEach(XPlugin.pendingXModules, (_, xModule) => {
      this.registerXModule(xModule);
    });
    XPlugin.pendingXModules = {};
  }

  /**
   * Registers the global reactive {@link XConfig}.
   *
   * @internal
   */
  protected registerConfig(): void {
    const config: XConfig = deepMerge({}, DEFAULT_X_CONFIG, this.options.config);
    this.createAdapterConfigChangedListener(this.options.adapter);
    this.xConfig = registerReactiveConfig(this.bus, config);
  }

  /**
   * If the received adapter supports it, it registers a listener to emit the
   * {@link XEventsTypes.AdapterConfigChanged} event whenever the config of it changes.
   *
   * @param adapter - The adapter to register the listener when its config changes.
   * @internal
   */
  protected createAdapterConfigChangedListener(adapter: SearchAdapter): void {
    adapter.addConfigChangedListener?.(newAdapterConfig => {
      this.bus.emit('AdapterConfigChanged', newAdapterConfig);
    });
  }

  /**
   * Checks if a the type of the store emitter selector is simple or complex. This selector can be
   * a function if it is simple or an object with the selector and other options if it is complex.
   *
   * @param stateSelector - The store emitter selector.
   * @returns A boolean which flags if the stateSelector is simple (function) or complex (object).
   * @internal
   */
  protected isSimpleSelector(
    stateSelector: AnySimpleStateSelector | AnyStateSelector
  ): stateSelector is AnySimpleStateSelector {
    return typeof stateSelector === 'function';
  }

  /**
   * Registers filters globally.
   *
   * @internal
   */
  protected registerFilters(): void {
    forEach(FILTERS_REGISTRY, (filterName, filterFunction) =>
      this.vue.filter(filterName, filterFunction)
    );
  }
}

/**
 * Vue plugin that modifies each component instance, extending them with the
 * {@link XComponentAPI | X Component API }.
 *
 * @example
 * Minimal installation example. A search adapter is needed for the plugin to work, and connect to
 * the API.
 * ```typescript
 * const adapter = new EmpathyAdapterBuilder()
 *  .withConfiguration({instance: 'my-instance-id'})
 *  .build();
 * Vue.use(xPlugin, { adapter });
 * ```
 *
 * @example
 * If you are using {@link https://vuex.vuejs.org/ | Vuex} in your project you must install its
 *   plugin, and instantiate an store before installing the XPlugin:
 * ```typescript
 * Vue.use(Vuex);
 * const store = new Store({ ... });
 * Vue.use(xPlugin, { adapter, store });
 * ```
 * @public
 */
export const xPlugin = new XPlugin(bus);

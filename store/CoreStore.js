//The store is an event emitter.
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');
var {isArray, isEmpty, isObject} = require('lodash/lang');
var getEntityInformations = require('../definition/entity/builder').getEntityInformations;
var capitalize = require('lodash/string/capitalize');
var Immutable = require('immutable');
var AppDispatcher = require('../dispatcher');
/**
 * @class CoreStore
 */
class CoreStore extends EventEmitter {

  /**
   * Contructor of the store class.
   */
  constructor(config) {
    assign(this, {
      config
    });
    //Initialize the data as immutable map.
    this.data = Immutable.Map({});
    this.status = Immutable.Map({});
    this.error = Immutable.Map({});
    this.customHandler = assign({}, config.customHandler);
    //Register all gernerated methods.
    this.buildDefinition();
    this.buildEachNodeChangeEventListener();
    this.registerDispatcher();
  }

  /**
   * Initialize the store configuration.
   * @param {object} storeConfiguration - The store configuration for the initialization.
   */
  buildDefinition() {
      /**
       * Build the definitions for the entity (may be a subject.)
       * @type {object}
       */
      this.definition = this.config.definition || getEntityInformations(
        this.config.definitionPath,
        this.config.customDefinition
      );
      return this.definition;
  }
  /** Return the status of a definition.
   * @returns {string} - The status of a definition.
   */
  getStatus(def){
    if (this.status.has(def)){
      return this.status.get(def);
    }
    return undefined;
  }

  emitAll(){
    this.emitArray.map((evtToEmit)=>{
      this.emit(evtToEmit.name, evtToEmit.data);
    });
  }

  willEmit(eventName, data){
    this.emitArray.push({name: eventName, data: data});
  }

  /**
  * Build a change listener for each property in the definition. (should be macro entities);
  */
  buildEachNodeChangeEventListener() {
    var currentStore = this;
      //Loop through each store properties.
      for (var definition in this.definition) {
        var capitalizeDefinition = capitalize(definition);
        //Creates the change listener
        currentStore[`add${capitalizeDefinition}ChangeListener`] = function(def){
          return function (cb) {
            currentStore.addListener(`${def}:change`, cb);
        }}(definition);
        //Remove the change listener
        currentStore[`remove${capitalizeDefinition}ChangeListener`] = function(def){
          return function (cb) {
            currentStore.removeListener(`${def}:change`, cb);
        }}(definition);
        //Create an update method.
        currentStore[`update${capitalizeDefinition}`] = function(def){
          return function (dataNode, status) {
            var immutableNode = Immutable.fromJS(dataNode);
            currentStore.data = currentStore.data.set(def, immutableNode);
            //Update the status on the data.
            currentStore.status = currentStore.status.set(def, status);
            currentStore.willEmit(`${def}:change`, {property: def, status: status});
        }}(definition);
        //Create a get method.
        currentStore[`get${capitalizeDefinition}`] = function(def){
          return function () {
            var hasData = currentStore.data.has(def);
            if(hasData){
              var rawData = currentStore.data.get(def);
              if (isObject(rawData)) {
                var data = rawData.toJS();
                if(!isEmpty(data)){
                  return data;
                }
              } else {
                return rawData;
              }
            }
            return undefined;
          };
        }(definition);
        //Creates the error change listener
        currentStore[`add${capitalizeDefinition}ErrorListener`] = function(def){
            return function (cb) {
              currentStore.addListener(`${def}:error`, cb);
        }}(definition);
        //Remove the change listener
        currentStore[`remove${capitalizeDefinition}ErrorListener`] = function(def){
            return function (cb) {
              currentStore.removeListener(`${def}:error`, cb);
        }}(definition);
        //Create an update method.
        currentStore[`updateError${capitalizeDefinition}`] = function(def){
            return function (dataNode) {
              //CheckIsObject
              var immutableNode = Immutable[isArray(dataNode) ? "List" : "Map"](dataNode);
              currentStore.error = currentStore.error.set(def, immutableNode);
              currentStore.willEmit(`${def}:error`);
        }}(definition);
        //Create a get method.
        currentStore[`getError${capitalizeDefinition}`] = function(def){
            return function(){
              var hasData = currentStore.error.has(def);
              return hasData ? currentStore.error.get(def).toJS() : undefined;
            };
        }(definition);
      }
    }
  /**
   * The store registrer itself on the dispatcher.
   */
  registerDispatcher(){
    var currentStore = this;
    this.dispatch = AppDispatcher.register(function(transferInfo) {
      //Complete rewrie by the store.
      //todo: see if this has meaning instead of an override
      currentStore.emitArray = [];
      if(currentStore.globalCustomHandler){
        return currentStore.globalCustomHandler.call(currentStore, transferInfo);
      }
      var rawData = transferInfo.action.data;
      var status = transferInfo.action.status || {};
      var type = transferInfo.action.type;
      for(var node in rawData){
        if(currentStore.definition[node]){
          //Call a custom handler if this exists.
          if(currentStore.customHandler && currentStore.customHandler[node] && currentStore.customHandler[node][type]){
            currentStore.customHandler[node][type].call(currentStore, rawData[node], status[node]);
          }else {
            //Update the data for the given node. and emit the change/.
            currentStore[`${type}${capitalize(node)}`](rawData[node], status[node]);
          }
        }
      }
      Promise.resolve().then(function(d){
        currentStore.emitAll();
      });

      //console.log('dispatchHandler:action', transferInfo);
    });
  }
    /**
     * Add a listener on a store event.
     * @param {string}   eventName - Event name.
     * @param {Function} cb - CallBack to call on the event change name.
     */
  addListener(eventName, cb) {
    this.on(eventName, cb);
  }

}
module.exports = CoreStore;

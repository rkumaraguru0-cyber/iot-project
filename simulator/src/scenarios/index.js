const { SCENARIO_DEFINITIONS, getScenarioDefinition } = require('./scenarioDefinitions');
const ScenarioRunner = require('./scenarioRunner');

/**
 * Factory to instantiate a ScenarioRunner.
 * 
 * @param {number|string} scenarioId
 * @param {Object} [options={}]
 * @returns {ScenarioRunner}
 */
function createScenarioRunner(scenarioId, options = {}) {
  return new ScenarioRunner(scenarioId, options);
}

module.exports = {
  SCENARIO_DEFINITIONS,
  getScenarioDefinition,
  ScenarioRunner,
  createScenarioRunner
};

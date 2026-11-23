/**
 * Contract for question storage. Implementation lives in src/data.
 * @typedef {import('./Question.js').Question} Question
 */
export class QuestionRepository {
  /** @param {{ subject?: string }} [filter] @returns {Promise<Question[]>} */
  async list(filter) {
    throw new Error('QuestionRepository.list is not implemented');
  }

  /** @param {Question} question @returns {Promise<Question>} */
  async create(question) {
    throw new Error('QuestionRepository.create is not implemented');
  }

  /** @param {string} id @param {Question} question @returns {Promise<Question>} */
  async update(id, question) {
    throw new Error('QuestionRepository.update is not implemented');
  }

  /** @param {string} id @returns {Promise<void>} */
  async remove(id) {
    throw new Error('QuestionRepository.remove is not implemented');
  }

  /** @param {string[]} ids @returns {Promise<void>} */
  async removeMany(ids) {
    throw new Error('QuestionRepository.removeMany is not implemented');
  }

  /** @param {string[]} ids @param {boolean} active @returns {Promise<void>} */
  async setActive(ids, active) {
    throw new Error('QuestionRepository.setActive is not implemented');
  }

  /** @param {Question[]} questions @returns {Promise<number>} */
  async createMany(questions) {
    throw new Error('QuestionRepository.createMany is not implemented');
  }
}

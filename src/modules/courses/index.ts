export {
  getAllCourses,
  getClosestGreeniesByCourseId,
  getCourseByHandle,
  getCourseForEdit,
  getCoursesWithTees,
  getFewestPuttsRoundsByCourseId,
  getLowestRoundsByCourseId,
  type CourseForEdit,
  type CourseForEditTee,
} from "./lib/queries";
export { getCourseIdByHandle, isTeeForCourse } from "./lib/tees";
export {
  deleteCourse,
  updateCourse,
  type CourseDeleteResult,
  type CourseUpdateInput,
  type CourseUpdateResult,
} from "./lib/writes";

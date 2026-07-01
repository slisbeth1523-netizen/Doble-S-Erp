export type SortDirection = "asc" | "desc";

export type SortingInput<TAllowedSort extends string = string> = {
  sortBy?: TAllowedSort;
  sortDirection?: SortDirection;
};

export type Sorting<TAllowedSort extends string = string> = {
  sortBy: TAllowedSort;
  sortDirection: SortDirection;
};

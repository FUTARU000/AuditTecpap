export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchGroup {
  type: string;
  label: string;
  results: SearchHit[];
}

export interface GroupedSearchResultDto {
  query: string;
  total: number;
  groups: SearchGroup[];
}

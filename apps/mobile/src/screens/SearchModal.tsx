import { PlaceholderScreen } from '../components/PlaceholderScreen';

// Web's search has no real results either (Section 7) - this stays a placeholder entry
// point until real search exists on both platforms.
export function SearchModal() {
  return <PlaceholderScreen title="Search" subtitle="Search coming next." />;
}

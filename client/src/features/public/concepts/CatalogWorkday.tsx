import { Landing } from '../Landing';
import { ConceptSwitcher } from './materials';

/** Catalogue option 3, now the live landing page; served here too so the switcher still reaches it. */
export function CatalogWorkday() {
  return (
    <>
      <Landing />
      <ConceptSwitcher current="catalog-workday" />
    </>
  );
}

import type { ScopeHotel } from '../../domain/scope.ts';

/**
 * The hotel scope, as conversation instructions. The names and codes come from the hotel directory (`resolveScope`),
 * never from the client, so nothing a visitor types reaches the prompt through the scope.
 */

const names = (scope: readonly ScopeHotel[]) => scope.map((hotel) => `${hotel.name} (${hotel.code})`).join(', ');

/** Kassandra: who the answer is for. Null for the whole group. */
export function scopeInstructions(scope: readonly ScopeHotel[]): string | null {
  if (!scope.length) return null;
  return (
    `You are answering for: ${names(scope)}. ` +
    'The person works on these hotels only, and every data tool is limited to them: a call without hotels reads exactly ' +
    'these, and a call for another hotel is refused. Do not report on, rank against or compare with other hotels of the ' +
    'group. If the person asks about a hotel outside this scope, say that hotel is not among the hotels selected and that ' +
    'they can change hotels in the sidebar. In run_readonly_query, return hotel_code and filter on these codes.'
  );
}

/** The workflow builder: the hotels a new workflow watches unless the person says otherwise. Null for the whole group. */
export function builderScopeInstructions(scope: readonly ScopeHotel[]): string | null {
  if (!scope.length) return null;
  return (
    `The person is working on: ${names(scope)}. Unless they name other hotels, the workflow watches these: call ` +
    'set_hotels with their codes, not ["ALL"]. The data tools you read are limited to these hotels.'
  );
}

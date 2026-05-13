import { SectionStub } from '@/components/SectionStub.jsx';

export default function ReviewsList() {
  return (
    <SectionStub
      title="Reviews"
      subtitle="User-submitted reviews awaiting moderation."
      endpointGroup="Reviews (/admin/review/)"
      endpoints={[
        'GET /admin/review/',
      ]}
      columns={['User', 'Vehicle', 'Rating', 'Posted', 'Actions']}
    />
  );
}

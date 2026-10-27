import '../Sass/Components/CardSkeleton.scss'

const CardSkeleton = () => {
  return (
    <div className="exp-skeleton" aria-hidden="true">
      <div className="exp-skeleton-body">
        <div className="exp-skeleton-top">
          <span className="sk sk-icon" />
          <span className="sk sk-meta" />
        </div>
        <div className="sk sk-title" />
        <div className="sk sk-line" />
        <div className="sk sk-line short" />
      </div>
      <div className="exp-skeleton-footer">
        <span className="sk sk-btn" />
      </div>
    </div>
  )
}

export default CardSkeleton

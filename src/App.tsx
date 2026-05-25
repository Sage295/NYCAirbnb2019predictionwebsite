import { useEffect, useMemo, useRef, useState } from 'react'

type HouseModel = {
  vertices: number[][]
  faces: { indexes: number[]; material: string; order: number }[]
}

type ReportItem = {
  title: string
  body: string[]
  images?: string[]
}

const smoothWallMaterials = new Set([
  'foundation_mosaic',
  'marble_grey',
  'plaster_grey',
  'plaster_white',
  'wood_balls',
])

const lightVector = [-0.32, -0.62, 0.72]

const airbnbReportTimeline: ReportItem[] = [
  {
    title: 'Introduction',
    body: [
      'New York City hosts one of the busiest Airbnb markets, and prices vary because of location, room type, demand, and listing details.',
      'This project uses New York City Airbnb Open Data from 2019, with roughly 48,895 listings across the five boroughs.',
      'The goal was to explore the data, clean it, compare models, and build a prediction experience that helps estimate listing prices.',
    ],
  },
  {
    title: 'Missing Values Analysis',
    body: [
      'Most columns had no missing values, but last_review and reviews_per_month had substantial missingness. Smaller missing counts appeared in name and host_name.',
      'Understanding missing values helped guide preprocessing before modeling.',
    ],
    images: ['page-02-image-01.png'],
  },
  {
    title: 'Summary Statistics',
    body: [
      'The price variable was strongly right-skewed, with a median much lower than the mean and extreme outliers reaching very high prices.',
      'Minimum nights, reviews, and availability also showed wide ranges, making preprocessing important before model training.',
    ],
    images: ['page-03-image-01.png', 'page-03-image-02.png'],
  },
  {
    title: 'Correlation Analysis of Numerical Features',
    body: [
      'Numerical features had weak linear relationships with price, suggesting that pricing depends on nonlinear interactions between many variables.',
      'The relationship between number_of_reviews and reviews_per_month showed listing activity but also possible multicollinearity.',
    ],
    images: ['page-04-image-01.png'],
  },
  {
    title: 'Exploratory Data Analysis',
    body: [
      'Room type and location were major pricing signals. Entire homes and apartments were usually more expensive, especially in Manhattan and Brooklyn.',
      'Private rooms and shared rooms were generally cheaper, while cheaper listings tended to receive more reviews.',
      'The EDA showed that categorical and geographic factors mattered more than simple numerical correlations.',
    ],
    images: [
      'page-05-image-01.png',
      'page-05-image-02.png',
      'page-05-image-03.png',
      'page-05-image-04.png',
      'page-06-image-01.png',
      'page-06-image-02.png',
    ],
  },
  {
    title: 'Business Insights',
    body: [
      'Hosts can increase booking activity by pricing competitively and considering neighborhood demand.',
      'Entire homes in prime locations can bring higher revenue, but price depends on multiple interacting factors.',
      'Dynamic pricing is more useful than one fixed rule because Airbnb pricing is not driven by a single feature.',
    ],
  },
  {
    title: 'Log Transformation of Price',
    body: [
      'A log transformation reduced price skew and made the target variable easier for models to learn.',
      'This helped reduce the influence of extreme outliers on model performance.',
    ],
    images: ['page-07-image-01.png'],
  },
  {
    title: 'Data Preprocessing',
    body: [
      'The dataset was cleaned, high prices were filtered, missing review-related values were handled, and a days_since_last_review feature was created.',
      'Numerical features were scaled and categorical variables were converted with one-hot encoding, increasing the feature space for modeling.',
    ],
  },
  {
    title: 'Models Preamble',
    body: [
      'Linear Regression, Decision Tree, Random Forest, and Gradient Boosting were compared to understand which model best fit the pricing task.',
      'Because the data showed nonlinear patterns, tree-based models were expected to perform well.',
    ],
    images: ['page-08-image-01.png', 'page-08-image-02.png'],
  },
  {
    title: 'Model Evaluation and Results',
    body: [
      'Models were evaluated with RMSE, MAE, and R-squared.',
      'Random Forest performed the best, followed closely by Gradient Boosting. Linear Regression was moderate, and the Decision Tree overfit the data.',
    ],
  },
  {
    title: 'Feature Importance and Model Performance Analysis',
    body: [
      'Feature importance showed that room type and location were the strongest pricing signals.',
      'The prediction plot showed that the best model captured general pricing trends in log-transformed price space.',
    ],
    images: ['page-09-image-01.png', 'page-09-image-02.png'],
  },
  {
    title: 'Limitations',
    body: [
      'The model predicts log-transformed prices, so predictions need to be converted back to dollars.',
      'The dataset does not include real-time demand, seasonality, events, or newer market changes after 2019.',
    ],
  },
  {
    title: 'Conclusion',
    body: [
      'Airbnb prices are influenced by multiple features, especially room type and location.',
      'Random Forest gave the strongest results because it handled nonlinear relationships better than simpler models.',
    ],
  },
]

function parseObjModel(source: string): HouseModel {
  const vertices: number[][] = []
  const faces: HouseModel['faces'] = []
  let activeMaterial = 'plaster_white'

  source.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('v ')) {
      const [, x, y, z] = trimmed.split(/\s+/)
      vertices.push([Number(x), Number(y), Number(z)])
    }
    if (trimmed.startsWith('usemtl ')) {
      activeMaterial = trimmed.replace('usemtl ', '').trim()
    }
    if (trimmed.startsWith('f ')) {
      const indexes = trimmed
        .split(/\s+/)
        .slice(1)
        .map((part) => Number(part.split('/')[0]) - 1)
        .filter((index) => Number.isFinite(index))

      if (indexes.length >= 3 && activeMaterial !== 'wood_light') {
        faces.push({ indexes, material: activeMaterial, order: faces.length })
      }
    }
  })

  if (!vertices.length) return { vertices, faces }

  const bounds = vertices.reduce(
    (acc, vertex) => ({
      min: acc.min.map((value, index) => Math.min(value, vertex[index])),
      max: acc.max.map((value, index) => Math.max(value, vertex[index])),
    }),
    {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    },
  )
  const center = bounds.min.map((value, index) => (value + bounds.max[index]) / 2)
  const size = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  )

  return {
    vertices: vertices.map((vertex) => vertex.map((value, index) => (value - center[index]) / size)),
    faces,
  }
}

function rotateVertex(vertex: number[], rotateY: number, rotateX: number) {
  const [x, y, z] = vertex
  const cosY = Math.cos(rotateY)
  const sinY = Math.sin(rotateY)
  const yRotatedX = x * cosY - z * sinY
  const yRotatedZ = x * sinY + z * cosY
  const cosX = Math.cos(rotateX)
  const sinX = Math.sin(rotateX)

  return [yRotatedX, y * cosX - yRotatedZ * sinX, y * sinX + yRotatedZ * cosX]
}

function getFaceNormal(points: number[][]) {
  const [a, b, c] = points
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ]
  const length = Math.hypot(normal[0], normal[1], normal[2]) || 1

  return normal.map((value) => value / length)
}

function materialColor(material: string) {
  const colors: Record<string, [number, number, number]> = {
    foundation_mosaic: [118, 113, 101],
    glass_window: [102, 128, 133],
    marble_grey: [136, 134, 126],
    metal_dark: [38, 37, 34],
    metal_grey: [84, 82, 76],
    mirror_lamp: [185, 178, 160],
    plaster_grey: [160, 156, 145],
    plaster_white: [213, 206, 188],
    plate_grey: [78, 76, 70],
    wood_balls: [128, 88, 46],
    wood_light: [154, 108, 59],
  }
  const base = colors[material] ?? [190, 181, 158]
  const warmth: [number, number, number] = [196, 183, 154]

  return base.map((value, index) => Math.round(value * 0.88 + warmth[index] * 0.12)) as [
    number,
    number,
    number,
  ]
}

function App() {
  const siteRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modelRef = useRef<HouseModel | null>(null)
  const targetScrollProgressRef = useRef(0)
  const [size, setSize] = useState('650')
  const [propertyType, setPropertyType] = useState('apartment')
  const [borough, setBorough] = useState('Manhattan')
  const [bedrooms, setBedrooms] = useState('1')
  const [view, setView] = useState<'main' | 'team'>('main')

  const estimate = useMemo(() => {
    const baseByBorough: Record<string, number> = {
      Manhattan: 185,
      Brooklyn: 125,
      Queens: 90,
      Bronx: 72,
      'Staten Island': 85,
    }
    const typeMultiplier: Record<string, number> = {
      apartment: 1,
      house: 1.12,
      penthouse: 1.75,
      'private room': 0.62,
      'shared room': 0.38,
    }
    const parsedSize = Number(size) || 0
    const parsedBedrooms = Number(bedrooms) || 0

    return Math.round(
      (baseByBorough[borough] + parsedSize * 0.035 + parsedBedrooms * 22) *
        typeMultiplier[propertyType],
    )
  }, [bedrooms, borough, propertyType, size])

  useEffect(() => {
    fetch('/airbnb-predictor/Bambo_House.obj')
      .then((response) => response.text())
      .then((text) => {
        modelRef.current = parseObjModel(text)
      })
      .catch(() => {
        modelRef.current = { vertices: [], faces: [] }
      })
  }, [])

  useEffect(() => {
    const revealItems = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.16 },
    )

    revealItems.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateScroll = () => {
      const formStart = Math.max(window.innerHeight * 1.25, 1)
      const next = Math.min(window.scrollY / formStart, 1)
      targetScrollProgressRef.current = next
      siteRef.current?.style.setProperty('--airbnb-scroll', next.toFixed(3))
    }

    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    window.addEventListener('resize', updateScroll)
    return () => {
      window.removeEventListener('scroll', updateScroll)
      window.removeEventListener('resize', updateScroll)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined

    let animationId = 0
    const render = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      const rect = canvas.getBoundingClientRect()
      const canvasWidth = Math.round(rect.width * pixelRatio)
      const canvasHeight = Math.round(rect.height * pixelRatio)

      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth
        canvas.height = canvasHeight
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, rect.width, rect.height)

      const model = modelRef.current
      const progress = targetScrollProgressRef.current
      const rotation = -0.2 - progress * 1.34
      const rotated = model?.vertices.map((vertex) => rotateVertex(vertex, rotation, -0.12)) ?? []
      const isCompact = rect.width < 860
      const scale = Math.min(rect.width, rect.height) * (isCompact ? 0.6 - progress * 0.08 : 0.9 - progress * 0.24)
      const centerX = rect.width * (isCompact ? 0.5 - progress * 0.1 : 0.6 - progress * 0.28)
      const centerY = rect.height * (isCompact ? 0.57 + progress * 0.04 : 0.5 + progress * 0.02)

      if (!model || !rotated.length) {
        context.fillStyle = '#d8c6a3'
        context.font = '700 22px Inter, sans-serif'
        context.textAlign = 'center'
        context.fillText('Loading house model...', rect.width / 2, rect.height / 2)
      } else {
        model.faces
          .map((item) => ({
            ...item,
            depth: item.indexes.reduce((sum, index) => sum + rotated[index][2], 0) / item.indexes.length,
          }))
          .sort((a, b) => (a.depth === b.depth ? a.order - b.order : b.depth - a.depth))
          .forEach(({ indexes, material }) => {
            const rotatedPoints = indexes.map((index) => rotated[index])
            const normal = getFaceNormal(rotatedPoints)
            if (normal[2] > 0.42 && material !== 'glass_window') return

            const brightness = Math.max(
              0.78,
              Math.min(
                1.05,
                0.92 +
                  (normal[0] * lightVector[0] + normal[1] * lightVector[1] + normal[2] * lightVector[2]) *
                    0.14,
              ),
            )
            const base = materialColor(material)
            const points = indexes.map((index) => {
              const [x, y, z] = rotated[index]
              const perspective = 1.9 / (1.9 + z)
              return [centerX + x * scale * perspective, centerY - y * scale * perspective]
            })

            context.beginPath()
            points.forEach(([x, y], index) => {
              if (index === 0) context.moveTo(x, y)
              else context.lineTo(x, y)
            })
            context.closePath()

            const shouldSmoothWall = smoothWallMaterials.has(material)
            const materialBrightness =
              material === 'glass_window'
                ? 0.94
                : shouldSmoothWall
                  ? 0.94
                  : material.includes('metal') || material === 'plate_grey'
                    ? brightness * 0.88
                    : brightness
            const litColor = base.map((channel) =>
              Math.max(0, Math.min(255, Math.round(channel * materialBrightness))),
            )
            const warmHighlight = litColor.map((channel, index) =>
              Math.min(255, Math.round(channel * 1.03 + [3, 2, 0][index])),
            )
            const coolShadow = litColor.map((channel, index) =>
              Math.max(0, Math.round(channel * 0.86 - [2, 1, 0][index])),
            )
            const minX = Math.min(...points.map(([x]) => x))
            const maxX = Math.max(...points.map(([x]) => x))
            const minY = Math.min(...points.map(([, y]) => y))
            const maxY = Math.max(...points.map(([, y]) => y))
            const fill = context.createLinearGradient(minX, minY, maxX, maxY)
            fill.addColorStop(0, `rgb(${warmHighlight.join(', ')})`)
            fill.addColorStop(0.52, `rgb(${litColor.join(', ')})`)
            fill.addColorStop(1, `rgb(${coolShadow.join(', ')})`)
            context.fillStyle = shouldSmoothWall ? `rgb(${litColor.join(', ')})` : fill
            context.strokeStyle =
              material === 'glass_window' ? 'rgba(232, 246, 242, 0.22)' : 'rgba(24, 21, 17, 0.08)'
            context.lineWidth = material === 'glass_window' ? 0.55 : shouldSmoothWall ? 0 : 0.28
            context.fill()
            if (!shouldSmoothWall) context.stroke()
          })
      }

      animationId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(animationId)
  }, [])

  if (view === 'team') {
    return <MeetTheTeamPage onBack={() => setView('main')} />
  }

  return (
    <main className="airbnb-site" ref={siteRef}>
      <section className="airbnb-hero">
        <div className="airbnb-copy">
          <h1>Hello, welcome to NY Airbnb Prices Predictor.</h1>
          <span>Need help setting the right price for your Airbnb?</span>
          <a href="#airbnb-form">Scroll to get started</a>
        </div>

        <div className="airbnb-house-stage" aria-label="Rotating 3D house preview">
          <canvas ref={canvasRef}></canvas>
        </div>
      </section>

      <section className="airbnb-form-section" id="airbnb-form">
        <div className="airbnb-form-card">
          <p>Price helper</p>
          <h2>Tell the model about your listing</h2>
          <div className="airbnb-fields">
            <label>
              Airbnb size
              <input
                type="number"
                min="0"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                placeholder="Square feet"
              />
            </label>
            <label>
              Property type
              <select value={propertyType} onChange={(event) => setPropertyType(event.target.value)}>
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="penthouse">Penthouse</option>
                <option value="private room">Private room</option>
                <option value="shared room">Shared room</option>
              </select>
            </label>
            <label>
              Borough
              <select value={borough} onChange={(event) => setBorough(event.target.value)}>
                <option>Manhattan</option>
                <option>Brooklyn</option>
                <option>Queens</option>
                <option>Bronx</option>
                <option>Staten Island</option>
              </select>
            </label>
            <label>
              Bedrooms
              <input
                type="number"
                min="0"
                value={bedrooms}
                onChange={(event) => setBedrooms(event.target.value)}
              />
            </label>
          </div>
          <div className="airbnb-estimate">
            <span>Suggested nightly price</span>
            <strong>${estimate}</strong>
            <small>Demo estimate based on 2019 NYC pricing patterns.</small>
          </div>
        </div>
      </section>

      <section className="airbnb-report-section" aria-labelledby="airbnb-report-title">
        <div className="airbnb-report-intro">
          <p>Understanding Airbnb Pricing in New York City: A Data-Driven Analysis</p>
          <h2 id="airbnb-report-title">Report Timeline</h2>
          <span>By Sejal Mogalgiddi, Apoorva Thirukazhukundram Shakila Raja</span>
        </div>

        <div className="airbnb-report-timeline">
          {airbnbReportTimeline.map((item) => (
            <article className="airbnb-report-item" key={item.title} data-reveal>
              <div className="airbnb-report-marker" aria-hidden="true"></div>
              <div className="airbnb-report-content">
                <h3>{item.title}</h3>
                {item.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {item.images ? (
                  <div className="airbnb-report-images">
                    {item.images.map((image) => (
                      <img
                        src={`/airbnb-report-assets/${image}`}
                        alt={`${item.title} report figure`}
                        loading="lazy"
                        key={image}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <div className="report-actions">
          <button className="airbnb-team-button" type="button" onClick={() => setView('team')}>
            Meet the Team
          </button>
        </div>
      </section>
    </main>
  )
}

function MeetTheTeamPage({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <main className="airbnb-info-page">
      <button className="airbnb-info-back" type="button" onClick={onBack}>
        Back to report
      </button>

      <section className="team-profile">
        <p>Project Team</p>
        <h1>Meet the Team</h1>
        <article>
          <h2>Apoorva Thirukazhukundram Shakila Raja</h2>
          <p>
            Passionate about data analytics and data science, with a strong interest in
            turning data into meaningful insights and impactful solutions. Fluent in
            French and currently learning Spanish, while continuously exploring new
            technologies and analytical tools.
          </p>
          <h3>Major</h3>
          <p>
            Pursuing a major in Data Science with minors in Computer Science and
            Statistics at the University of Central Florida (UCF).
          </p>
          <h3>Aim</h3>
          <p>
            Aspiring to build a career as a Data Scientist and Data Analyst, using
            data-driven approaches to solve real-world problems, create innovative
            solutions, and contribute to the growth of technology and business
            intelligence.
          </p>
        </article>
      </section>
    </main>
  )
}

export default App
